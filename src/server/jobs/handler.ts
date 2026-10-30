import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { reportError } from "@/lib/observability/report";
import { jsonResponse } from "@/server/http";
import type { JobFn, JobResult, JobRunRecord } from "@/server/jobs/registry";

export type JobRequestDeps = {
  registry: Record<string, JobFn>;
  /** The bearer secret, or null when the jobs are not configured. */
  secret: () => string | null;
  now: () => Date;
  /**
   * Writes one finished run (job_runs). Optional: without it nothing is recorded. A
   * failure is reported and never changes the response.
   */
  record?: (run: JobRunRecord) => Promise<void>;
};

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Constant-time bearer check. Both sides are hashed first, so the comparison
 * always runs on two 32-byte values and does not reveal the secret's length.
 */
function isAuthorized(header: string | null, secret: string): boolean {
  const presented = /^bearer (.+)$/i.exec(header ?? "")?.[1] ?? "";
  return timingSafeEqual(digest(presented), digest(secret));
}

/**
 * Runs one scheduled job. Called only by the platform scheduler, with the CRON_SECRET bearer token.
 * A run that finishes, or throws, is recorded once. Requests refused before the job runs are not.
 */
export async function handleJobRequest(request: Request, jobName: string, deps: JobRequestDeps): Promise<Response> {
  const secret = deps.secret();
  if (!secret) return jsonResponse({ error: "jobs_not_configured" }, 503);
  if (!isAuthorized(request.headers.get("authorization"), secret)) return jsonResponse({ error: "unauthorized" }, 401);

  const job = Object.hasOwn(deps.registry, jobName) ? deps.registry[jobName] : undefined;
  if (!job) return jsonResponse({ error: "unknown_job" }, 404);

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  const startedAt = performance.now();

  let result: JobResult;
  try {
    result = await job({ now: deps.now(), dryRun });
  } catch (error) {
    reportError(error, { area: `jobs.${jobName}` });
    await recordRun(deps, { job: jobName, ok: false, dryRun, result: {}, durationMs: performance.now() - startedAt });
    return jsonResponse({ error: "internal" }, 500);
  }
  await recordRun(deps, { job: jobName, ok: true, dryRun, result, durationMs: performance.now() - startedAt });
  return jsonResponse({ job: jobName, ok: true, dryRun, result }, 200);
}

/** Records a run. Never throws: a failed write is reported with its code only. */
async function recordRun(deps: JobRequestDeps, run: JobRunRecord): Promise<void> {
  if (!deps.record) return;
  try {
    await deps.record(run);
  } catch (error) {
    reportError(error, { area: "jobs.record", code: "record" });
  }
}
