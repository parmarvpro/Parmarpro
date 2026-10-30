/**
 * AI phase 3, database: public.ops_counts(), the counts the founder's daily digest reports.
 * Each count is checked against rows seeded for it. Every check reads since a start time
 * taken from the database clock, so earlier rows are never counted. The rows each test
 * seeds are deleted by id in afterAll; nothing else in the database is touched.
 */
import { randomBytes, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { admin, asRole, closePool, createClinicFixture, deleteClinicFixture, type ClinicFixture } from "../helpers/db";

const KEYS = [
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

type Counts = Record<(typeof KEYS)[number], number>;

const tag = () => randomBytes(6).toString("hex");
const MODEL = "ops-test-model";

let A: ClinicFixture;

// Row ids seeded by these tests, deleted in afterAll.
const seeded = { jobRuns: [] as string[], notifications: [] as string[], webhooks: [] as string[], aiCalls: [] as string[] };
const seededOrders: string[] = [];

beforeAll(async () => {
  A = await createClinicFixture("ops");
});

afterAll(async () => {
  await admin("delete from public.job_runs where id = any($1::bigint[])", [seeded.jobRuns]);
  await admin("delete from public.notification_log where id = any($1::bigint[])", [seeded.notifications]);
  await admin("delete from public.webhook_events where id = any($1::bigint[])", [seeded.webhooks]);
  await admin("delete from public.ai_calls where id = any($1::bigint[])", [seeded.aiCalls]);
  await admin("delete from public.billing_orders where id = any($1::uuid[])", [seededOrders]);
  await deleteClinicFixture(A);
  await closePool();
});

/** The database clock as text with microseconds: the start time of a check. */
async function dbNow(): Promise<string> {
  const { rows } = await admin<{ now: string }>("select now()::text as now");
  return rows[0]!.now;
}

/** public.ops_counts(since), called as the service role, exactly as the app calls it. */
async function countsSince(since: string): Promise<Counts> {
  const result = await asRole("service_role", null, (q) =>
    q<{ c: Counts }>("select public.ops_counts($1::timestamptz) as c", [since]),
  );
  expect(result.error).toBeNull();
  return result.rows[0]!.c;
}

async function insertJobRun(job: string, ok: boolean, dryRun: boolean, result: Record<string, unknown> = {}): Promise<void> {
  const { rows } = await admin<{ id: string }>(
    "insert into public.job_runs (job, ok, dry_run, result, duration_ms) values ($1, $2, $3, $4::jsonb, 1) returning id",
    [job, ok, dryRun, JSON.stringify(result)],
  );
  seeded.jobRuns.push(rows[0]!.id);
}

describe("OPS-01 the function returns exactly the agreed keys", () => {
  it("returns the eleven counts as integers, and no other key", async () => {
    const counts = await countsSince(await dbNow());
    expect(Object.keys(counts).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) expect(Number.isInteger(counts[key])).toBe(true);
  });
});

describe("OPS-02 scheduled job runs", () => {
  it("counts real runs since the start time, and the failed ones among them", async () => {
    await insertJobRun("ops-test-run", false, false); // before the start time: not counted
    const since = await dbNow();
    await insertJobRun("ops-test-run", true, false);
    await insertJobRun("ops-test-run", false, false);
    await insertJobRun("ops-test-run", true, true); // a dry run is not a real run

    const counts = await countsSince(since);
    expect(counts.job_runs).toBe(2);
    expect(counts.job_runs_failed).toBe(1);
  });
});

describe("OPS-03 scheduled jobs that did not run", () => {
  it("starts at five, and drops only for a real, successful run", async () => {
    const since = await dbNow();
    expect((await countsSince(since)).jobs_not_run).toBe(5);

    await insertJobRun("expire-invitations", true, true); // a dry run does not count
    await insertJobRun("staff-digest", false, false); // a failed run does not count
    expect((await countsSince(since)).jobs_not_run).toBe(5);

    await insertJobRun("expire-invitations", true, false);
    expect((await countsSince(since)).jobs_not_run).toBe(4);

    await insertJobRun("expire-invitations", true, false); // a second run changes nothing
    expect((await countsSince(since)).jobs_not_run).toBe(4);
  });
});

describe("OPS-04 emails failed and the email budget", () => {
  it("sums the job results of real runs, and counts a missing or non-number value as zero", async () => {
    const since = await dbNow();
    await insertJobRun("ops-test-mail", true, false, { failed: 2, budget_exhausted: 1, sent: 9 });
    await insertJobRun("ops-test-mail", true, false, { sent: 4 }); // no failed key
    await insertJobRun("ops-test-mail", true, false, { failed: true, budget_exhausted: false }); // not numbers
    await insertJobRun("ops-test-mail", true, true, { failed: 5, budget_exhausted: 3 }); // a dry run
    await insertJobRun("ops-test-mail", true, false, { failed: 1 });

    const counts = await countsSince(since);
    expect(counts.emails_failed).toBe(3);
    expect(counts.email_budget_hits).toBe(1);
  });
});

describe("OPS-05 emails sent today", () => {
  it("counts notification rows since midnight IST, and not older rows", async () => {
    const before = await countsSince(await dbNow());

    const { rows: today } = await admin<{ id: string }>(
      "insert into public.notification_log (kind, subject_key, period_key) values ('ops_test', $1, 'today') returning id",
      [`ops-test-${tag()}`],
    );
    seeded.notifications.push(today[0]!.id);
    const { rows: old } = await admin<{ id: string }>(
      "insert into public.notification_log (kind, subject_key, period_key, created_at) values ('ops_test', $1, 'old', now() - interval '2 days') returning id",
      [`ops-test-${tag()}`],
    );
    seeded.notifications.push(old[0]!.id);

    const after = await countsSince(await dbNow());
    expect(after.emails_sent_today - before.emails_sent_today).toBe(1);
  });
});

describe("OPS-06 failed webhooks", () => {
  it("counts failed webhook events received since the start time", async () => {
    const since = await dbNow();
    const failed = await admin<{ id: string }>(
      `insert into public.webhook_events (provider, event_id, event_type, status, payload_sha256)
       values ('razorpay', $1, 'payment.failed', 'failed', $2) returning id`,
      [`ops-test-${tag()}`, randomBytes(32).toString("hex")],
    );
    seeded.webhooks.push(failed.rows[0]!.id);
    const processed = await admin<{ id: string }>(
      `insert into public.webhook_events (provider, event_id, event_type, status, payload_sha256)
       values ('razorpay', $1, 'payment.captured', 'processed', $2) returning id`,
      [`ops-test-${tag()}`, randomBytes(32).toString("hex")],
    );
    seeded.webhooks.push(processed.rows[0]!.id);

    expect((await countsSince(since)).webhooks_failed).toBe(1);
  });
});

describe("OPS-07 orders unpaid for more than an hour", () => {
  async function insertOrder(status: string, createdAgo: string): Promise<void> {
    const id = randomUUID();
    await admin(
      `insert into public.billing_orders (id, clinic_id, provider_order_id, plan_code, period_months, base_paise, gst_paise,
                                          amount_paise, created_by, status, created_at)
       values ($1, $2, $3, 'parmarpro_clinic_monthly', 1, 100, 18, 118, $4, $5, now() - $6::interval)`,
      [id, A.id, `order_ops${tag()}`, A.owner.userId, status, createdAgo],
    );
    seededOrders.push(id);
  }

  it("counts created orders older than an hour, and no others", async () => {
    const before = await countsSince(await dbNow());

    await insertOrder("created", "2 hours"); // counted
    await insertOrder("created", "10 minutes"); // too recent
    await insertOrder("paid", "2 hours"); // not unpaid

    const after = await countsSince(await dbNow());
    expect(after.orders_unpaid_over_1h - before.orders_unpaid_over_1h).toBe(1);
  });
});

describe("OPS-08 AI calls", () => {
  async function insertCall(status: string): Promise<void> {
    const { rows } = await admin<{ id: string }>(
      `insert into public.ai_calls (lane, model, feature, est_input_tokens, status)
       values ('free', $1, 'ops_test', 1, $2) returning id`,
      [MODEL, status],
    );
    seeded.aiCalls.push(rows[0]!.id);
  }

  it("counts AI calls since the start time, and those that failed or were rate limited", async () => {
    await insertCall("ok"); // before the start time: not counted
    const since = await dbNow();
    await insertCall("ok");
    await insertCall("failed");
    await insertCall("invalid_output");
    await insertCall("rate_limited");
    await insertCall("reserved");

    const counts = await countsSince(since);
    expect(counts.ai_calls).toBe(5);
    expect(counts.ai_calls_failed).toBe(2);
    expect(counts.ai_calls_rate_limited).toBe(1);
  });
});

describe("OPS-09 access and input", () => {
  it.each(["anon", "authenticated"] as const)("%s cannot execute the function", async (role) => {
    const claims = role === "authenticated" ? A.owner.claims : null;
    const result = await asRole(role, claims, (q) => q("select public.ops_counts(now())"));
    expect(result.error?.code).toBe("42501");
  });

  it("refuses a missing start time rather than counting from nothing", async () => {
    const result = await asRole("service_role", null, (q) => q("select public.ops_counts(null::timestamptz)"));
    expect(result.error?.code).toBe("22004");
  });
});
