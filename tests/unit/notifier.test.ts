import { beforeEach, describe, expect, it, vi } from "vitest";

import { EMAIL_DAILY_BUDGET, createNotifier, type NotificationKey, type NotifierDeps, type SendOnceParams } from "@/server/privileged/notifications";
import type { SendResult } from "@/server/email/send";

// The default deps are not exercised here, so the privileged client is replaced
// with a stub that fails loudly if anything reaches it.
vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => {
    throw new Error("privileged client must not be used in this test");
  },
}));
vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

const NOW = new Date("2026-10-29T20:00:00Z"); // 01:30 on 30 Oct IST
const IST_DAY_START = new Date("2026-10-29T18:30:00Z");

const KEY: NotificationKey = { kind: "weekly_summary", clinicId: "clinic_1", subjectKey: "clinic:clinic_1", periodKey: "2026-W44" };
const PARAMS: SendOnceParams = {
  ...KEY,
  to: "owner@example.test",
  content: { subject: "Weekly summary", text: "text", html: "<p>html</p>" },
  dryRun: false,
};

type Options = {
  configured?: boolean;
  alreadySent?: boolean;
  sentToday?: number;
  claimed?: boolean;
  result?: SendResult;
  throwOnSend?: boolean;
};

function harness(options: Options = {}) {
  const claim = vi.fn<NotifierDeps["claim"]>(async () => options.claimed ?? true);
  const release = vi.fn<NotifierDeps["release"]>(async () => undefined);
  const alreadySent = vi.fn<NotifierDeps["alreadySent"]>(async () => options.alreadySent ?? false);
  const sentSince = vi.fn<NotifierDeps["sentSince"]>(async () => options.sentToday ?? 0);
  const send = vi.fn<NotifierDeps["send"]>(async () => {
    if (options.throwOnSend) throw new Error("defect");
    return options.result ?? { ok: true, id: "em_1" };
  });
  const deps: NotifierDeps = {
    claim,
    release,
    alreadySent,
    sentSince,
    send,
    configured: () => options.configured ?? true,
    now: () => NOW,
  };
  return { claim, release, alreadySent, sentSince, send, notifier: createNotifier(deps) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notifier.sendOnce", () => {
  it("does nothing and reports not_configured when email is not configured", async () => {
    const h = harness({ configured: false });
    await expect(h.notifier.sendOnce(PARAMS)).resolves.toBe("not_configured");
    expect(h.alreadySent).not.toHaveBeenCalled();
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("dry run reports dry_run without claiming or sending", async () => {
    const h = harness();
    await expect(h.notifier.sendOnce({ ...PARAMS, dryRun: true })).resolves.toBe("dry_run");
    expect(h.alreadySent).toHaveBeenCalledWith(KEY);
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.release).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("dry run reports duplicate when the period was already sent", async () => {
    const h = harness({ alreadySent: true });
    await expect(h.notifier.sendOnce({ ...PARAMS, dryRun: true })).resolves.toBe("duplicate");
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("stops at the daily budget, counting from the IST day start", async () => {
    const h = harness({ sentToday: EMAIL_DAILY_BUDGET });
    await expect(h.notifier.sendOnce(PARAMS)).resolves.toBe("budget_exhausted");
    expect(h.sentSince).toHaveBeenCalledWith(IST_DAY_START);
    expect(h.claim).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it("still sends one below the daily budget", async () => {
    const h = harness({ sentToday: EMAIL_DAILY_BUDGET - 1 });
    await expect(h.notifier.sendOnce(PARAMS)).resolves.toBe("sent");
  });

  it("reports duplicate and sends nothing when the claim is refused", async () => {
    const h = harness({ claimed: false });
    await expect(h.notifier.sendOnce(PARAMS)).resolves.toBe("duplicate");
    expect(h.claim).toHaveBeenCalledWith(KEY);
    expect(h.send).not.toHaveBeenCalled();
    expect(h.release).not.toHaveBeenCalled();
  });

  it("releases the claim when the provider rejects the email, so a later run can retry", async () => {
    const h = harness({ result: { ok: false, reason: "rejected" } });
    await expect(h.notifier.sendOnce(PARAMS)).resolves.toBe("failed");
    expect(h.release).toHaveBeenCalledWith(KEY);
  });

  it("releases the claim when sending throws", async () => {
    const h = harness({ throwOnSend: true });
    await expect(h.notifier.sendOnce(PARAMS)).resolves.toBe("failed");
    expect(h.release).toHaveBeenCalledWith(KEY);
  });

  it("claims, sends to the recipient and keeps the claim on success", async () => {
    const h = harness();
    await expect(h.notifier.sendOnce(PARAMS)).resolves.toBe("sent");
    expect(h.claim).toHaveBeenCalledWith(KEY);
    expect(h.send).toHaveBeenCalledWith("owner@example.test", PARAMS.content);
    expect(h.release).not.toHaveBeenCalled();
  });
});
