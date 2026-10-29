export type JobContext = { now: Date; dryRun: boolean };

export type JobResult = Record<string, number | string | boolean>;

export type JobFn = (ctx: JobContext) => Promise<JobResult>;

/**
 * Scheduled jobs, keyed by the URL segment of POST /api/jobs/[job].
 * Phase 3 registers the jobs here. Until then the endpoint answers 404 for every name.
 */
export const JOBS: Record<string, JobFn> = {};
