import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { reportError } from "@/lib/observability/report";
import { jsonResponse } from "@/server/http";
import type { JobFn } from "@/server/jobs/registry";

export type JobRequestDeps = {
  registry: Record<string, JobFn>;
  /** The bearer secret, or null when the jobs are not configured. */
  secret: () => string | null;
  now: () => Date;
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

/** Runs one scheduled job. Called only by the platform scheduler, with the CRON_SECRET bearer token. */
export async function handleJobRequest(request: Request, jobName: string, deps: JobRequestDeps): Promise<Response> {
  const secret = deps.secret();
  if (!secret) return jsonResponse({ error: "jobs_not_configured" }, 503);
  if (!isAuthorized(request.headers.get("authorization"), secret)) return jsonResponse({ error: "unauthorized" }, 401);

  const job = Object.hasOwn(deps.registry, jobName) ? deps.registry[jobName] : undefined;
  if (!job) return jsonResponse({ error: "unknown_job" }, 404);

  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  try {
    const result = await job({ now: deps.now(), dryRun });
    return jsonResponse({ job: jobName, ok: true, dryRun, result }, 200);
  } catch (error) {
    reportError(error, { area: `jobs.${jobName}` });
    return jsonResponse({ error: "internal" }, 500);
  }
}
