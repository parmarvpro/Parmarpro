/**
 * The operations counts for the founder's daily digest: the keys that the database
 * function public.ops_counts() returns, and the rule for when they need attention.
 * Pure (no server-only), so the email templates, the AI feature and the tests can
 * share one definition. Every value is a count, never personal data.
 */

export const OPS_COUNT_KEYS = [
  "job_runs",
  "job_runs_failed",
  "jobs_not_run",
  "emails_failed",
  "email_budget_hits",
  "emails_sent_today",
  "webhooks_failed",
  "orders_unpaid_over_1h",
  "ai_calls",
  "ai_calls_failed",
  "ai_calls_rate_limited",
] as const;

export type OpsCountKey = (typeof OPS_COUNT_KEYS)[number];

export type OpsCounts = Record<OpsCountKey, number>;

/** A count above zero under one of these means something needs a look. */
const ATTENTION_KEYS: readonly OpsCountKey[] = [
  "job_runs_failed",
  "jobs_not_run",
  "emails_failed",
  "email_budget_hits",
  "webhooks_failed",
  "orders_unpaid_over_1h",
  "ai_calls_failed",
];

export function opsNeedsAttention(counts: OpsCounts): boolean {
  return ATTENTION_KEYS.some((key) => counts[key] > 0);
}
