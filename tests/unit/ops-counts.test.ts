import { describe, expect, it } from "vitest";

import { OPS_COUNT_KEYS, opsNeedsAttention, type OpsCounts } from "@/lib/ops-counts";

const QUIET: OpsCounts = {
  job_runs: 6,
  job_runs_failed: 0,
  jobs_not_run: 0,
  emails_failed: 0,
  email_budget_hits: 0,
  emails_sent_today: 4,
  webhooks_failed: 0,
  orders_unpaid_over_1h: 0,
  ai_calls: 3,
  ai_calls_failed: 0,
  ai_calls_rate_limited: 0,
};

describe("OPS_COUNT_KEYS", () => {
  it("names exactly the eleven counts, in the order the digest shows them", () => {
    expect([...OPS_COUNT_KEYS]).toEqual([
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
    ]);
  });
});

describe("opsNeedsAttention", () => {
  it("is false when every count that signals a problem is zero", () => {
    expect(opsNeedsAttention(QUIET)).toBe(false);
  });

  it.each([
    "job_runs_failed",
    "jobs_not_run",
    "emails_failed",
    "email_budget_hits",
    "webhooks_failed",
    "orders_unpaid_over_1h",
    "ai_calls_failed",
  ] as const)("is true when %s is above zero", (key) => {
    expect(opsNeedsAttention({ ...QUIET, [key]: 1 })).toBe(true);
  });

  it.each(["job_runs", "emails_sent_today", "ai_calls", "ai_calls_rate_limited"] as const)(
    "ignores %s, which is activity rather than a problem",
    (key) => {
      expect(opsNeedsAttention({ ...QUIET, [key]: 500 })).toBe(false);
    },
  );
});
