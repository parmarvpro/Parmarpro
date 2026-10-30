import "server-only";

import { z } from "zod";

import type { OpsCounts } from "@/lib/ops-counts";
import type { JobResult, JobRunRecord } from "@/server/jobs/registry";
import { privilegedDb } from "@/server/privileged/client";

/**
 * PRIVILEGED operations log. recordJobRun() writes one job_runs row per finished
 * run, holding numbers and booleans only. opsCounts() reads the counts from
 * public.ops_counts() and throws on any shape it does not expect, so a changed
 * function fails the digest instead of sending wrong figures.
 */

const COUNT = z.number().int().nonnegative();

// The keys must match OPS_COUNT_KEYS. `satisfies` fails to compile when one is missing,
// and strictObject rejects an extra one at run time.
const OpsCountsSchema = z.strictObject({
  job_runs: COUNT,
  job_runs_failed: COUNT,
  jobs_not_run: COUNT,
  emails_failed: COUNT,
  email_budget_hits: COUNT,
  emails_sent_today: COUNT,
  webhooks_failed: COUNT,
  orders_unpaid_over_1h: COUNT,
  ai_calls: COUNT,
  ai_calls_failed: COUNT,
  ai_calls_rate_limited: COUNT,
}) satisfies z.ZodType<OpsCounts>;

type CountValue = number | boolean;

function isCountValue(value: unknown): value is CountValue {
  return typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value));
}

/**
 * The part of a job result that may be stored: finite numbers and booleans. Strings
 * and anything else are dropped, so a job cannot write personal data into job_runs
 * even by mistake.
 */
export function countsOnly(result: JobResult): Record<string, CountValue> {
  return Object.fromEntries(Object.entries(result).filter((entry): entry is [string, CountValue] => isCountValue(entry[1])));
}

export async function recordJobRun(run: JobRunRecord): Promise<void> {
  const { error } = await privilegedDb()
    .from("job_runs")
    .insert({
      job: run.job,
      ok: run.ok,
      dry_run: run.dryRun,
      result: countsOnly(run.result),
      duration_ms: Number.isFinite(run.durationMs) ? Math.max(0, Math.round(run.durationMs)) : 0,
    });
  if (error) throw error;
}

/** The operations counts since `since`. Throws on a database error or an unexpected shape. */
export async function opsCounts(since: Date): Promise<OpsCounts> {
  const { data, error } = await privilegedDb().rpc("ops_counts", { p_since: since.toISOString() });
  if (error) throw error;
  const parsed = OpsCountsSchema.safeParse(data);
  if (!parsed.success) throw new Error("ops_counts_shape");
  return parsed.data;
}
