import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import { handleJobRequest } from "@/server/jobs/handler";
import type { JobFn, JobRunRecord } from "@/server/jobs/registry";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

// Test-only value, not a real secret.
const SECRET = "cron_test_secret_0123456789abcdef0123456789"; // gitleaks:allow synthetic test value
const NOW = new Date("2026-10-29T20:00:00Z");

type Recorded = (run: JobRunRecord) => Promise<void>;

const recorder = () => vi.fn<Recorded>(async () => {});

function request(path: string, authorization?: string): Request {
  return new Request(`https://app.example.test/api/jobs/${path}`, {
    method: "POST",
    headers: authorization === undefined ? {} : { authorization },
  });
}

function setup() {
  const echo = vi.fn<JobFn>(async ({ dryRun }) => ({ processed: 3, dryRun }));
  const broken = vi.fn<JobFn>(async () => {
    throw new Error("connection to db.internal failed for patient Meera");
  });
  const registry = { echo, broken };
  const deps = { registry, secret: () => SECRET, now: () => NOW };
  return { echo, broken, registry, deps };
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

describe("handleJobRequest", () => {
  it("answers 503 when the job secret is not configured, and runs nothing", async () => {
    const { echo, deps } = setup();
    const response = await handleJobRequest(request("echo", `Bearer ${SECRET}`), "echo", { ...deps, secret: () => null });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "jobs_not_configured" });
    expect(echo).not.toHaveBeenCalled();
  });

  it.each([
    ["no authorization header", undefined],
    ["wrong token", `Bearer ${"x".repeat(SECRET.length)}`],
    ["the secret with a suffix", `Bearer ${SECRET}x`],
    ["the secret without the scheme", SECRET],
    ["another scheme", `Basic ${SECRET}`],
    ["an empty bearer token", "Bearer "],
  ])("answers 401 for %s and runs nothing", async (_name, authorization) => {
    const { echo, deps } = setup();
    const response = await handleJobRequest(request("echo", authorization), "echo", deps);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(echo).not.toHaveBeenCalled();
  });

  it("accepts the bearer scheme in any letter case", async () => {
    const { echo, deps } = setup();
    const response = await handleJobRequest(request("echo", `bearer ${SECRET}`), "echo", deps);
    expect(response.status).toBe(200);
    expect(echo).toHaveBeenCalledTimes(1);
  });

  it("answers 404 for an unknown job, including inherited object names", async () => {
    const { deps } = setup();
    for (const name of ["missing", "toString", "__proto__"]) {
      const response = await handleJobRequest(request(name, `Bearer ${SECRET}`), name, deps);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "unknown_job" });
    }
  });

  it("answers 401 rather than 404 for an unknown job without credentials", async () => {
    const { deps } = setup();
    const response = await handleJobRequest(request("missing"), "missing", deps);
    expect(response.status).toBe(401);
  });

  it("runs the job and returns its result, with dryRun true when ?dryRun=1", async () => {
    const { echo, deps } = setup();
    const url = new Request("https://app.example.test/api/jobs/echo?dryRun=1", {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}` },
    });

    const response = await handleJobRequest(url, "echo", deps);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ job: "echo", ok: true, dryRun: true, result: { processed: 3, dryRun: true } });
    expect(echo).toHaveBeenCalledWith({ now: NOW, dryRun: true });
  });

  it("runs for real when dryRun is absent or not exactly 1", async () => {
    const { echo, deps } = setup();
    const response = await handleJobRequest(request("echo", `Bearer ${SECRET}`), "echo", deps);
    expect(await response.json()).toMatchObject({ dryRun: false, result: { dryRun: false } });
    expect(echo).toHaveBeenCalledWith({ now: NOW, dryRun: false });
  });

  it("answers 500 with no detail when the job throws, and reports it under the job's area", async () => {
    const { deps } = setup();
    const response = await handleJobRequest(request("broken", `Bearer ${SECRET}`), "broken", deps);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe(JSON.stringify({ error: "internal" }));
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.broken" });
  });
});

describe("handleJobRequest, recording runs", () => {
  it("records a finished run with its result, its dry-run flag and its duration", async () => {
    const { deps } = setup();
    const record = recorder();

    await handleJobRequest(request("echo", `Bearer ${SECRET}`), "echo", { ...deps, record });

    expect(record).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith({
      job: "echo",
      ok: true,
      dryRun: false,
      result: { processed: 3, dryRun: false },
      durationMs: expect.any(Number),
    });
    expect(record.mock.calls[0]?.[0].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records a dry run as a dry run", async () => {
    const { deps } = setup();
    const record = recorder();
    const url = new Request("https://app.example.test/api/jobs/echo?dryRun=1", {
      method: "POST",
      headers: { authorization: `Bearer ${SECRET}` },
    });

    await handleJobRequest(url, "echo", { ...deps, record });

    expect(record).toHaveBeenCalledWith(expect.objectContaining({ job: "echo", ok: true, dryRun: true }));
  });

  it("records a thrown job as not ok, with an empty result, and still answers 500 with no detail", async () => {
    const { deps } = setup();
    const record = recorder();

    const response = await handleJobRequest(request("broken", `Bearer ${SECRET}`), "broken", { ...deps, record });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "internal" });
    expect(record).toHaveBeenCalledWith({
      job: "broken",
      ok: false,
      dryRun: false,
      result: {},
      durationMs: expect.any(Number),
    });
  });

  it("reports a failed record under jobs.record and leaves the success response unchanged", async () => {
    const { deps } = setup();
    const record = vi.fn<Recorded>(async () => {
      throw new Error("insert failed for Synthetic Patient Meera");
    });

    const response = await handleJobRequest(request("echo", `Bearer ${SECRET}`), "echo", { ...deps, record });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ job: "echo", ok: true, dryRun: false, result: { processed: 3, dryRun: false } });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.record", code: "record" });
  });

  it("leaves the failure response unchanged when the record also fails", async () => {
    const { deps } = setup();
    const record = vi.fn<Recorded>(async () => {
      throw new Error("insert failed");
    });

    const response = await handleJobRequest(request("broken", `Bearer ${SECRET}`), "broken", { ...deps, record });

    expect(response.status).toBe(500);
    expect(await response.text()).toBe(JSON.stringify({ error: "internal" }));
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.broken" });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.record", code: "record" });
  });

  it("records nothing for an unknown job, a missing credential or a missing secret", async () => {
    const { deps } = setup();
    const record = recorder();

    await handleJobRequest(request("missing", `Bearer ${SECRET}`), "missing", { ...deps, record });
    await handleJobRequest(request("echo"), "echo", { ...deps, record });
    await handleJobRequest(request("echo", `Bearer ${SECRET}`), "echo", { ...deps, record, secret: () => null });

    expect(record).not.toHaveBeenCalled();
  });

  it("works without a record dependency, and records nothing", async () => {
    const { deps } = setup();

    const response = await handleJobRequest(request("echo", `Bearer ${SECRET}`), "echo", deps);

    expect(response.status).toBe(200);
    expect(reportError).not.toHaveBeenCalled();
  });
});
