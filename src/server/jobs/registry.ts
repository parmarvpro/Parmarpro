import "server-only";

import { expireInvitationsJob } from "@/server/jobs/expire-invitations";
import { founderDigestJob } from "@/server/jobs/founder-digest";
import { patientRemindersJob } from "@/server/jobs/patient-reminders";
import { reconcilePaymentsJob } from "@/server/jobs/reconcile-payments";
import { staffDigestJob } from "@/server/jobs/staff-digest";
import { trialRenewalJob } from "@/server/jobs/trial-renewal";
import { weeklySummaryJob } from "@/server/jobs/weekly-summary";

export type JobContext = { now: Date; dryRun: boolean };

export type JobResult = Record<string, number | string | boolean>;

export type JobFn = (ctx: JobContext) => Promise<JobResult>;

/**
 * Scheduled jobs, keyed by the URL segment of POST /api/jobs/[job]. The job
 * modules import the types above with `import type`, so these value imports
 * do not form a runtime cycle.
 */
export const JOBS: Record<string, JobFn> = {
  "reconcile-payments": reconcilePaymentsJob,
  "expire-invitations": expireInvitationsJob,
  "trial-renewal": trialRenewalJob,
  "staff-digest": staffDigestJob,
  "weekly-summary": weeklySummaryJob,
  "patient-reminders": patientRemindersJob,
  "founder-digest": founderDigestJob,
};
