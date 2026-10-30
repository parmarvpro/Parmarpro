import { isConfigured, jobsEnv } from "@/lib/env";
import { jsonResponse } from "@/server/http";
import { handleJobRequest } from "@/server/jobs/handler";
import { JOBS } from "@/server/jobs/registry";
import { recordJobRun } from "@/server/privileged/ops";

/** Scheduled job endpoint. Authenticated by the CRON_SECRET bearer token only. */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }): Promise<Response> {
  const { job } = await params;
  return handleJobRequest(request, job, {
    registry: JOBS,
    secret: () => (isConfigured(jobsEnv) ? jobsEnv().CRON_SECRET : null),
    now: () => new Date(),
    record: recordJobRun,
  });
}

export function GET(): Response {
  return jsonResponse({ error: "method_not_allowed" }, 405);
}
