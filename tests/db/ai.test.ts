/**
 * AI feature, phase 1 (database layer): model limits and the call log, the
 * reserve and settle functions, the job run log, per-lead triage and the
 * enquiry-help setting. Runs against the real migrations.
 *
 * Test models are named test-model-<random>, get their own limits and are
 * removed in afterAll, so the seeded rows are never touched.
 */
import { randomBytes } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  admin,
  asRole,
  asUser,
  closePool,
  createClinicFixture,
  deleteClinicFixture,
  getPool,
  type ClinicFixture,
  type Query,
} from "../helpers/db";
import { loadTestEnv } from "../helpers/test-env";

const suffix = () => randomBytes(8).toString("hex");
const CALL_ID = /^\d+$/;
const PACIFIC_MIDNIGHT = "(date_trunc('day', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles')";
const GENEROUS = { rpm: 1000, tpm: 100_000_000, rpd: 10_000_000 };
const INSERT_TRIAGE =
  "insert into public.lead_ai_triage (lead_id, treatment, urgency, language, best_time, summary, model) values ($1, 'checkup_cleaning', 'routine', 'en', null, 'Asks about a check-up.', 'gemini-3.5-flash-lite')";

let A: ClinicFixture;
let B: ClinicFixture;
const testModels: string[] = [];

beforeAll(async () => {
  A = await createClinicFixture("aia");
  B = await createClinicFixture("aib");
});

afterAll(async () => {
  await admin("delete from public.ai_calls where model = any($1::text[])", [testModels]);
  await admin("delete from public.ai_model_limits where model = any($1::text[])", [testModels]);
  await deleteClinicFixture(B);
  await deleteClinicFixture(A);
  await closePool();
});

type Limits = { rpm: number; tpm: number; rpd: number; enabled?: boolean };

/** A test-only model with its own limits, so no test shares a counter with another. */
async function testModel(limits: Limits): Promise<string> {
  const model = `test-model-${randomBytes(6).toString("hex")}`;
  testModels.push(model);
  await admin(
    "insert into public.ai_model_limits (lane, model, rpm, tpm, rpd, enabled) values ('free', $1, $2, $3, $4, $5)",
    [model, limits.rpm, limits.tpm, limits.rpd, limits.enabled ?? true],
  );
  return model;
}

type ReserveArgs = {
  model: string;
  clinicId?: string | null;
  estTokens?: number;
  clinicDailyCap?: number | null;
  /** Epoch ms: wait until then before calling, so that parallel calls overlap. */
  startAt?: number;
  pool?: pg.Pool;
};

/**
 * Calls ai_reserve as the service role on its own pooled connection, in autocommit,
 * as the app's server code does. Each reservation is committed, so later calls see it.
 */
async function reserve({ model, clinicId = null, estTokens = 1, clinicDailyCap = null, startAt, pool }: ReserveArgs) {
  const client = await (pool ?? getPool()).connect();
  try {
    await client.query("set role service_role");
    if (startAt !== undefined) {
      await client.query("select pg_sleep(greatest(0, extract(epoch from ($1::timestamptz - clock_timestamp()))))", [
        new Date(startAt),
      ]);
    }
    const { rows } = await client.query<{ id: string | null }>(
      "select public.ai_reserve('free', $1, 'test_feature', $2, $3, $4) as id",
      [model, clinicId, estTokens, clinicDailyCap],
    );
    return rows[0]!.id;
  } finally {
    await client.query("reset role");
    client.release();
  }
}

/** Reserves inside the caller's open transaction, so nothing is committed. */
async function reserveIn(q: Query, model: string): Promise<string> {
  const { rows } = await q<{ id: string }>(
    "select public.ai_reserve('free', $1, 'test_feature', null, 10, null) as id",
    [model],
  );
  return rows[0]!.id;
}

describe("AI-01 the AI tables and functions are for the service role only", () => {
  const TABLES = ["ai_model_limits", "ai_calls", "job_runs"] as const;

  it.each(TABLES)("%s: anon and authenticated cannot read or write it", async (table) => {
    const anonRead = await asRole("anon", null, (q) => q(`select 1 from public.${table}`));
    const anonWrite = await asRole("anon", null, (q) => q(`insert into public.${table} default values`));
    const userRead = await asUser(A.owner.claims, (q) => q(`select 1 from public.${table}`));
    const userWrite = await asUser(A.owner.claims, (q) => q(`insert into public.${table} default values`));
    expect(anonRead.error?.code).toBe("42501");
    expect(anonWrite.error?.code).toBe("42501");
    expect(userRead.error?.code).toBe("42501");
    expect(userWrite.error?.code).toBe("42501");
  });

  it.each(TABLES)("%s: the service role can read it", async (table) => {
    const result = await asRole("service_role", null, (q) => q(`select 1 from public.${table} limit 1`));
    expect(result.error).toBeNull();
  });

  it.each(["anon", "authenticated"] as const)("%s cannot execute the reserve, settle or check functions", async (role) => {
    const claims = role === "authenticated" ? A.owner.claims : null;
    const result = await asRole(role, claims, async (q) => ({
      reserve: await q("select public.ai_reserve('free', 'gemini-3.5-flash-lite', 'test_feature', null, 1, null)"),
      settle: await q("select public.ai_settle(1, 'ok', null, null, null)"),
      counts: await q("select private.jsonb_counts_only('{}'::jsonb)"),
    }));
    expect(result.reserve.error?.code).toBe("42501");
    expect(result.settle.error?.code).toBe("42501");
    expect(result.counts.error?.code).toBe("42501");
  });

  it("the service role can execute ai_reserve and ai_settle", async () => {
    const model = await testModel(GENEROUS);
    const result = await asRole("service_role", null, async (q) => {
      const id = await reserveIn(q, model);
      const settled = await q("select public.ai_settle($1, 'ok', 1, 1, 0)", [id]);
      return { id, settled };
    });
    expect(result.id).toMatch(CALL_ID);
    expect(result.settled.error).toBeNull();
  });
});

describe("AI-02 the seeded placeholder limits", () => {
  it("are present for each lane and model, and enabled", async () => {
    const { rows } = await admin<{ lane: string; model: string; enabled: boolean }>(
      `select lane, model, enabled from public.ai_model_limits
        where model not like 'test-model-%' order by lane, model`,
    );
    expect(rows).toEqual([
      { lane: "free", model: "gemini-3.1-flash-lite", enabled: true },
      { lane: "free", model: "gemini-3.5-flash-lite", enabled: true },
      { lane: "free", model: "gemini-3.8-flash", enabled: true },
      { lane: "paid", model: "gemini-3.5-flash-lite", enabled: true },
      { lane: "paid", model: "gemini-3.8-flash", enabled: true },
    ]);
  });
});

describe("AI-03 ai_reserve grants a call within the limits", () => {
  it("returns an id and writes a reserved row with the token estimate", async () => {
    const model = await testModel(GENEROUS);
    const id = await reserve({ model, estTokens: 100 });
    expect(id).toMatch(CALL_ID);
    const { rows } = await admin<{ status: string; est_input_tokens: number; feature: string; clinic_id: string | null; settled_at: Date | null }>(
      "select status, est_input_tokens, feature, clinic_id, settled_at from public.ai_calls where id = $1",
      [id],
    );
    expect(rows).toEqual([
      { status: "reserved", est_input_tokens: 100, feature: "test_feature", clinic_id: null, settled_at: null },
    ]);
  });
});

describe("AI-04 ai_reserve refuses a call over a limit", () => {
  it("refuses the call that would exceed rpm", async () => {
    const model = await testModel({ rpm: 2, tpm: 100_000_000, rpd: 10_000_000 });
    const ids = [await reserve({ model }), await reserve({ model }), await reserve({ model })];
    expect(ids).toEqual([expect.stringMatching(CALL_ID), expect.stringMatching(CALL_ID), null]);
  });

  it("refuses a call whose tokens would take the minute over tpm, and admits one that lands exactly on it", async () => {
    const model = await testModel({ rpm: 100, tpm: 100, rpd: 1000 });
    const first = await reserve({ model, estTokens: 60 });
    const over = await reserve({ model, estTokens: 50 });
    const exact = await reserve({ model, estTokens: 40 });
    expect(first).toMatch(CALL_ID);
    expect(over).toBeNull();
    expect(exact).toMatch(CALL_ID);
  });

  it("refuses the call that would exceed rpd", async () => {
    const model = await testModel({ rpm: 100, tpm: 100_000_000, rpd: 2 });
    const ids = [await reserve({ model }), await reserve({ model }), await reserve({ model })];
    expect(ids).toEqual([expect.stringMatching(CALL_ID), expect.stringMatching(CALL_ID), null]);
  });

  it("ignores calls made before midnight Pacific when counting the day", async () => {
    const model = await testModel({ rpm: 1000, tpm: 100_000_000, rpd: 1 });
    await admin(
      `insert into public.ai_calls (lane, model, feature, est_input_tokens, created_at)
       values ('free', $1, 'test_feature', 1, ${PACIFIC_MIDNIGHT} - interval '1 second')`,
      [model],
    );
    expect(await reserve({ model })).toMatch(CALL_ID);
    expect(await reserve({ model })).toBeNull();
  });

  it("stops a clinic at its daily cap across models, and does not cap calls with no clinic", async () => {
    const first = await testModel(GENEROUS);
    const second = await testModel(GENEROUS);
    expect(await reserve({ model: first, clinicId: A.id, clinicDailyCap: 2 })).toMatch(CALL_ID);
    expect(await reserve({ model: second, clinicId: A.id, clinicDailyCap: 2 })).toMatch(CALL_ID);
    expect(await reserve({ model: first, clinicId: A.id, clinicDailyCap: 2 })).toBeNull();
    expect(await reserve({ model: first, clinicDailyCap: 2 })).toMatch(CALL_ID);
  });

  it("refuses a disabled model and an unknown one", async () => {
    const disabled = await testModel({ ...GENEROUS, enabled: false });
    const missing = `test-model-missing-${randomBytes(4).toString("hex")}`;
    expect(await reserve({ model: disabled })).toBeNull();
    expect(await reserve({ model: missing })).toBeNull();
  });

  it("rejects a negative token estimate", async () => {
    const model = await testModel(GENEROUS);
    await expect(reserve({ model, estTokens: -1 })).rejects.toMatchObject({ code: "22023" });
  });
});

describe("AI-05 concurrent reservations cannot overshoot rpm", () => {
  it("ten parallel reservations against rpm 3 give exactly three ids", async () => {
    const model = await testModel({ rpm: 3, tpm: 100_000_000, rpd: 10_000_000 });
    // Ten connections, and all ten wait for the same instant, so the calls really overlap.
    const wide = new pg.Pool({ connectionString: loadTestEnv().databaseUrl, max: 10 });
    const startAt = Date.now() + 500;
    let results: (string | null)[];
    try {
      results = await Promise.all(Array.from({ length: 10 }, () => reserve({ model, startAt, pool: wide })));
    } finally {
      await wide.end();
    }
    const granted = results.filter((id): id is string => id !== null);
    expect(granted).toHaveLength(3);
    expect(new Set(granted).size).toBe(3);
    const { rows } = await admin<{ n: string }>("select count(*)::text as n from public.ai_calls where model = $1", [model]);
    expect(rows[0]!.n).toBe("3");
  });
});

describe("AI-06 ai_settle records the outcome once", () => {
  type Settled = { status: string; input_tokens: number; output_tokens: number; thought_tokens: number; settled: boolean };
  const readCall = (q: Query, id: string) =>
    q<Settled>(
      `select status, input_tokens, output_tokens, thought_tokens, settled_at is not null as settled
         from public.ai_calls where id = $1`,
      [id],
    );

  it("sets the status and the token counts of a reserved call", async () => {
    const model = await testModel(GENEROUS);
    const result = await asRole("service_role", null, async (q) => {
      const id = await reserveIn(q, model);
      const settled = await q("select public.ai_settle($1, 'ok', 120, 45, 10)", [id]);
      return { settled, row: await readCall(q, id) };
    });
    expect(result.settled.error).toBeNull();
    expect(result.row.rows).toEqual([{ status: "ok", input_tokens: 120, output_tokens: 45, thought_tokens: 10, settled: true }]);
  });

  it("does not rewrite a call that is already settled", async () => {
    const model = await testModel(GENEROUS);
    const result = await asRole("service_role", null, async (q) => {
      const id = await reserveIn(q, model);
      await q("select public.ai_settle($1, 'ok', 120, 45, 10)", [id]);
      const again = await q("select public.ai_settle($1, 'failed', 1, 1, 1)", [id]);
      return { again, row: await readCall(q, id) };
    });
    expect(result.again.error).toBeNull();
    expect(result.row.rows).toEqual([{ status: "ok", input_tokens: 120, output_tokens: 45, thought_tokens: 10, settled: true }]);
  });

  it.each(["reserved", "bogus", ""])("raises on the status %j", async (status) => {
    const model = await testModel(GENEROUS);
    const result = await asRole("service_role", null, async (q) => {
      const id = await reserveIn(q, model);
      return q("select public.ai_settle($1, $2, 1, 1, 1)", [id, status]);
    });
    expect(result.error?.code).toBe("22023");
  });
});

describe("AI-07 the job run log holds counts only", () => {
  it("accepts a flat object of numbers and booleans", async () => {
    const result = await asRole("service_role", null, (q) =>
      q(
        "insert into public.job_runs (job, ok, dry_run, result, duration_ms) values ('ai-test-job', true, false, $1::jsonb, 12)",
        ['{"sent":2,"ok":true}'],
      ),
    );
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(1);
  });

  it.each([
    ["a string value", '{"sent":"2"}'],
    ["a nested object", '{"sent":{"count":2}}'],
    ["a null value", '{"sent":null}'],
    ["a top-level array", "[1,2]"],
  ])("rejects %s", async (_label, payload) => {
    const result = await asRole("service_role", null, (q) =>
      q(
        "insert into public.job_runs (job, ok, dry_run, result, duration_ms) values ('ai-test-job', true, false, $1::jsonb, 12)",
        [payload],
      ),
    );
    expect(result.error?.code).toBe("23514");
  });
});

describe("AI-08 retention keeps AI calls and job runs for 90 days", () => {
  it("job_cleanup removes rows older than 90 days and keeps recent ones", async () => {
    const model = "test-model-retention";
    const result = await asRole("service_role", null, async (q) => {
      await q(
        `insert into public.ai_calls (lane, model, feature, est_input_tokens, created_at) values
           ('free', $1, 'test_feature', 1, now() - interval '100 days'),
           ('free', $1, 'test_feature', 2, now() - interval '1 day')`,
        [model],
      );
      await q(
        `insert into public.job_runs (job, ok, dry_run, result, duration_ms, created_at) values
           ('ai-test-job', true, false, '{"sent":1}', 5, now() - interval '100 days'),
           ('ai-test-job', true, false, '{"sent":2}', 6, now() - interval '1 day')`,
      );
      const cleanup = await q<{ r: { ai_calls: number; job_runs: number } }>("select private.job_cleanup() as r");
      const calls = await q<{ est_input_tokens: number }>(
        "select est_input_tokens from public.ai_calls where model = $1",
        [model],
      );
      const runs = await q<{ sent: number }>(
        "select (result->>'sent')::int as sent from public.job_runs where job = 'ai-test-job'",
      );
      return { cleanup, calls, runs };
    });
    expect(result.cleanup.error).toBeNull();
    expect(result.cleanup.rows[0]!.r.ai_calls).toBeGreaterThanOrEqual(1);
    expect(result.cleanup.rows[0]!.r.job_runs).toBeGreaterThanOrEqual(1);
    expect(result.calls.rows).toEqual([{ est_input_tokens: 2 }]);
    expect(result.runs.rows).toEqual([{ sent: 2 }]);
  });
});

describe("AI-09 lead triage follows the rules for leads", () => {
  async function newLead(clinicId: string, label: string): Promise<string> {
    const { rows } = await admin<{ id: string }>(
      "insert into public.leads (clinic_id, full_name, source) values ($1, $2, 'website') returning id",
      [clinicId, `Triage ${label} ${suffix()}`],
    );
    return rows[0]!.id;
  }

  /** Writes a triage row as the database owner (fixtures only). */
  async function seedTriage(clinicId: string, leadId: string) {
    await admin(
      `insert into public.lead_ai_triage (lead_id, clinic_id, treatment, urgency, language, best_time, summary, model)
       values ($1, $2, 'checkup_cleaning', 'routine', 'en', 'Weekday mornings', 'Asks about a routine check-up.', 'gemini-3.5-flash-lite')`,
      [leadId, clinicId],
    );
  }

  it("members read their own clinic's triage, and nothing from another clinic", async () => {
    const aLead = await newLead(A.id, "read a");
    const bLead = await newLead(B.id, "read b");
    await seedTriage(A.id, aLead);
    await seedTriage(B.id, bLead);
    const ids = [aLead, bLead];
    const select = "select lead_id, clinic_id from public.lead_ai_triage where lead_id = any($1::uuid[])";
    const fromA = await asUser(A.viewer.claims, (q) => q<{ lead_id: string; clinic_id: string }>(select, [ids]));
    const fromB = await asUser(B.owner.claims, (q) => q<{ lead_id: string; clinic_id: string }>(select, [ids]));
    const anon = await asRole("anon", null, (q) => q("select lead_id from public.lead_ai_triage"));
    expect(fromA.error).toBeNull();
    expect(fromA.rows).toEqual([{ lead_id: aLead, clinic_id: A.id }]);
    expect(fromB.rows).toEqual([{ lead_id: bLead, clinic_id: B.id }]);
    expect(anon.error?.code).toBe("42501");
  });

  it("staff write triage for their clinic's leads; viewers cannot", async () => {
    const fresh = await newLead(A.id, "write new");
    const seeded = await newLead(A.id, "write seeded");
    await seedTriage(A.id, seeded);
    const insert = await asUser(A.staff.claims, (q) => q(INSERT_TRIAGE, [fresh]));
    expect(insert.error).toBeNull();
    expect(insert.rowCount).toBe(1);
    const update = await asUser(A.staff.claims, (q) =>
      q("update public.lead_ai_triage set summary = 'Asks about braces.' where lead_id = $1", [seeded]),
    );
    expect(update.error).toBeNull();
    expect(update.rowCount).toBe(1);
    const viewerLead = await newLead(A.id, "viewer new");
    const viewerInsert = await asUser(A.viewer.claims, (q) => q(INSERT_TRIAGE, [viewerLead]));
    expect(viewerInsert.error?.code).toBe("42501");
    const viewerUpdate = await asUser(A.viewer.claims, (q) =>
      q("update public.lead_ai_triage set summary = 'Changed by viewer.' where lead_id = $1", [seeded]),
    );
    expect(viewerUpdate.error).toBeNull();
    expect(viewerUpdate.rowCount).toBe(0);
  });

  it("a client cannot name the clinic when it writes triage", async () => {
    const lead = await newLead(A.id, "named clinic");
    const result = await asUser(A.staff.claims, (q) =>
      q(
        "insert into public.lead_ai_triage (clinic_id, lead_id, treatment, urgency, language, summary, model) values ($1, $2, 'checkup_cleaning', 'routine', 'en', 'Named clinic.', 'gemini-3.5-flash-lite')",
        [A.id, lead],
      ),
    );
    expect(result.error?.code).toBe("42501");
  });

  it("a user of clinic B cannot write triage for a lead of clinic A", async () => {
    const aLead = await newLead(A.id, "cross new");
    const insert = await asUser(B.owner.claims, (q) => q(INSERT_TRIAGE, [aLead]));
    expect(insert.error?.code).toBe("23503");
    const aSeeded = await newLead(A.id, "cross seeded");
    await seedTriage(A.id, aSeeded);
    const update = await asUser(B.owner.claims, (q) =>
      q("update public.lead_ai_triage set summary = 'Cross-clinic.' where lead_id = $1", [aSeeded]),
    );
    expect(update.error).toBeNull();
    expect(update.rowCount).toBe(0);
  });

  it("clinic_id and lead_id cannot be changed, by a client or by the database owner", async () => {
    const lead = await newLead(A.id, "immutable");
    const other = await newLead(A.id, "immutable other");
    await seedTriage(A.id, lead);
    const client = await asUser(A.owner.claims, async (q) => ({
      clinic: await q("update public.lead_ai_triage set clinic_id = $1 where lead_id = $2", [B.id, lead]),
      lead: await q("update public.lead_ai_triage set lead_id = $1 where lead_id = $2", [other, lead]),
    }));
    expect(client.clinic.error?.code).toBe("42501");
    expect(client.lead.error?.code).toBe("42501");
    await expect(
      admin("update public.lead_ai_triage set clinic_id = $1 where lead_id = $2", [B.id, lead]),
    ).rejects.toMatchObject({ code: "42501", message: "tenant identifiers are immutable" });
    await expect(
      admin("update public.lead_ai_triage set lead_id = $1 where lead_id = $2", [other, lead]),
    ).rejects.toMatchObject({ code: "42501", message: "tenant identifiers are immutable" });
  });

  it("deleting the lead deletes its triage row", async () => {
    const lead = await newLead(A.id, "deleted");
    await seedTriage(A.id, lead);
    const result = await asUser(A.owner.claims, async (q) => ({
      removed: await q("delete from public.leads where id = $1", [lead]),
      left: await q("select lead_id from public.lead_ai_triage where lead_id = $1", [lead]),
    }));
    expect(result.removed.error).toBeNull();
    expect(result.removed.rowCount).toBe(1);
    expect(result.left.rows).toHaveLength(0);
  });

  it.each([
    ["an unknown treatment", "botox", "Asks about botox."],
    ["a 161-character summary", "checkup_cleaning", "x".repeat(161)],
  ])("rejects %s", async (_label, treatment, summary) => {
    const lead = await newLead(A.id, "check");
    const result = await asUser(A.staff.claims, (q) =>
      q(
        "insert into public.lead_ai_triage (lead_id, treatment, urgency, language, summary, model) values ($1, $2, 'routine', 'en', $3, 'gemini-3.5-flash-lite')",
        [lead, treatment, summary],
      ),
    );
    expect(result.error?.code).toBe("23514");
  });

  it("accepts a 160-character summary", async () => {
    const lead = await newLead(A.id, "boundary");
    const result = await asUser(A.staff.claims, (q) =>
      q(
        "insert into public.lead_ai_triage (lead_id, treatment, urgency, language, summary, model) values ($1, 'checkup_cleaning', 'routine', 'en', $2, 'gemini-3.5-flash-lite')",
        [lead, "x".repeat(160)],
      ),
    );
    expect(result.error).toBeNull();
  });
});

describe("AI-10 the AI help with enquiries setting", () => {
  it("is off by default", async () => {
    const { rows } = await admin<{ ai_enquiry_help: boolean }>(
      "select ai_enquiry_help from public.clinic_automation_settings where clinic_id = $1",
      [A.id],
    );
    expect(rows).toEqual([{ ai_enquiry_help: false }]);
  });

  it.each(["owner", "admin"] as const)("%s can switch it on", async (role) => {
    const persona = role === "owner" ? A.owner : A.admin;
    const result = await asUser(persona.claims, async (q) => ({
      updated: await q("update public.clinic_automation_settings set ai_enquiry_help = true where clinic_id = $1", [A.id]),
      read: await q<{ ai_enquiry_help: boolean }>(
        "select ai_enquiry_help from public.clinic_automation_settings where clinic_id = $1",
        [A.id],
      ),
    }));
    expect(result.updated.error).toBeNull();
    expect(result.updated.rowCount).toBe(1);
    expect(result.read.rows).toEqual([{ ai_enquiry_help: true }]);
  });

  it.each(["staff", "viewer"] as const)("%s cannot change it (zero rows, no error)", async (role) => {
    const persona = role === "staff" ? A.staff : A.viewer;
    const result = await asUser(persona.claims, (q) =>
      q("update public.clinic_automation_settings set ai_enquiry_help = true where clinic_id = $1", [A.id]),
    );
    expect(result.error).toBeNull();
    expect(result.rowCount).toBe(0);
  });
});
