import "server-only";

import { expireInvitationsJob } from "@/server/jobs/expire-invitations";
import { founderDigestJob } from "@/server/jobs/founder-digest";
import { patientRemindersJob } from "@/server/jobs/patient-reminders";
import { staffDigestJob } from "@/server/jobs/staff-digest";
import { weeklySummaryJob } from "@/server/jobs/weekly-summary";

export type JobContext = { now: Date; dryRun: boolean };

export type JobResult = Record<string, number | string | boolean>;

export type JobFn = (ctx: JobContext) => Promise<JobResult>;

/** One finished job run, as it is written to job_runs. A failed run carries an empty result. */
export type JobRunRecord = { job: string; ok: boolean; dryRun: boolean; result: JobResult; durationMs: number };

/**
 * Scheduled jobs, keyed by the URL segment of POST /api/jobs/[job]. The job
 * modules import the types above with `import type`, so these value imports
 * do not form a runtime cycle.
 */
export const JOBS: Record<string, JobFn> = {
  "expire-invitations": expireInvitationsJob,
  "staff-digest": staffDigestJob,
  "weekly-summary": weeklySummaryJob,
  "patient-reminders": patientRemindersJob,
  "founder-digest": founderDigestJob,
};
