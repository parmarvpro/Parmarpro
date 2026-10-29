import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import { handleJobRequest } from "@/server/jobs/handler";
import type { JobFn } from "@/server/jobs/registry";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

// Test-only value, not a real secret.
const SECRET = "cron_test_secret_0123456789abcdef0123456789";
const NOW = new Date("2026-10-29T20:00:00Z");

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
