import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/contact/route";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  rpc: vi.fn(),
  sendOnce: vi.fn(),
  autoRepliesSentSince: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/server/db/anon-client", () => ({ createAnonDb: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/server/privileged/notifications", () => ({ notifier: () => ({ sendOnce: mocks.sendOnce }) }));
vi.mock("@/server/privileged/email-actions", () => ({ autoRepliesSentSince: mocks.autoRepliesSentSince }));
vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

// Synthetic values only.
const ENQUIRY_ID = "5f0c2a1e-7b1d-4c8e-9f3a-2d6b8e4c1a90";
const FORM = {
  fullName: "Synthetic Enquirer",
  clinicName: "Synthetic Dental",
  phone: "9800000077",
  email: "synthetic.enquirer@example.test",
  city: "Pune",
  message: "Synthetic message",
};

let ipCounter = 0;

/** A fresh client address per call, so the per-address limiter never interferes. */
function request(body: Record<string, unknown>): Request {
  ipCounter += 1;
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `198.51.100.${ipCounter}` },
    body: JSON.stringify(body),
  });
}

/** Runs each scheduled callback and returns the promises, so tests can wait for them. */
function runScheduled(): Promise<unknown[]> {
  const pending = mocks.after.mock.calls.map(([callback]) => (callback as () => unknown)());
  return Promise.allSettled(pending);
}

beforeEach(() => {
  mocks.after.mockReset();
  mocks.rpc.mockReset().mockResolvedValue({ data: ENQUIRY_ID, error: null });
  mocks.sendOnce.mockReset().mockResolvedValue("sent");
  mocks.autoRepliesSentSince.mockReset().mockResolvedValue(0);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/contact", () => {
  it("returns { ok: true } and schedules the enquiry emails after the response", async () => {
    vi.stubEnv("FOUNDER_ALERT_EMAIL", "founder@example.test");
    const response = await POST(request(FORM));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    expect(mocks.after).toHaveBeenCalledTimes(1);
    await runScheduled();
    const keys = mocks.sendOnce.mock.calls.map(([params]) => `${params.kind}:${params.subjectKey}`);
    expect(keys).toEqual([`enquiry_alert:${ENQUIRY_ID}`, `enquiry_auto_reply:${ENQUIRY_ID}`]);
  });

  it("returns { ok: true } even when every email fails", async () => {
    vi.stubEnv("FOUNDER_ALERT_EMAIL", "founder@example.test");
    mocks.sendOnce.mockRejectedValue(new Error("provider unavailable"));
    mocks.autoRepliesSentSince.mockRejectedValue(new Error("count unavailable"));

    const response = await POST(request(FORM));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    await expect(runScheduled()).resolves.toHaveLength(1);
  });

  it("a honeypot submission returns { ok: true }, stores nothing and schedules nothing", async () => {
    const response = await POST(request({ ...FORM, website: "https://spam.example.test" }));
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("a failed insert keeps its error response and schedules nothing", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "database unavailable" } });
    const response = await POST(request(FORM));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "internal" });
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
