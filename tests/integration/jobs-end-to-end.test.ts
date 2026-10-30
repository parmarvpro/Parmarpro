/**
 * Integration, end to end: the real scheduled jobs, called through POST /api/jobs/[job], against the
 * local database, with the real notifier and notification_log. Only the outside world is faked: Resend's
 * HTTP API (global fetch) and Clerk's user lookup. The checks are the ones that matter in production:
 * each email goes out once, a second run sends nothing, a failed send is retried, patients without
 * consent get nothing, and staff digests carry counts only.
 */
import { randomBytes } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { istDateKey } from "@/lib/ist";
import { OPS_COUNT_KEYS } from "@/lib/ops-counts";
import type { GenerateRequest, GenerateResult, Transport } from "@/server/ai/types";

import { admin, closePool, createClinicFixture, deleteClinicFixture, type ClinicFixture } from "../helpers/db";
import { mintToken } from "../helpers/jwt";
import { startRestProxy } from "../helpers/rest-proxy";

// Clerk is outside the test: every user id resolves to a synthetic address derived from it.
vi.mock("@/server/email/recipients", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/email/recipients")>();
  return {
    ...original,
    clerkRecipientLookup: () => async (userIds: string[]) =>
      new Map(userIds.map((id) => [id, { email: addressOf(id), firstName: null }])),
  };
});

function addressOf(userId: string): string {
  return `${userId.toLowerCase()}@example.test`;
}

type SentEmail = { to: string; subject: string; text: string; html: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const realFetch = globalThis.fetch;
let sent: SentEmail[] = [];
let resendStatus = 200;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

// Resend is outside the test: record each email and answer with the configured status. Every other
// request (PostgREST through the local proxy) goes to the real fetch.
vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
  if (requestUrl(input) !== RESEND_ENDPOINT) return realFetch(input, init);
  const body = JSON.parse(String(init?.body)) as { to: string[]; subject: string; text: string; html: string };
  sent.push({ to: body.to[0]!, subject: body.subject, text: body.text, html: body.html });
  return new Response(JSON.stringify({ id: `email_${sent.length}` }), {
    status: resendStatus,
    headers: { "content-type": "application/json" },
  });
});

const tag = () => randomBytes(6).toString("hex");
const cronSecret = randomBytes(32).toString("hex");

let proxy: Awaited<ReturnType<typeof startRestProxy>>;
let route: typeof import("@/app/api/jobs/[job]/route");
let A: ClinicFixture;
let B: ClinicFixture;

type JobBody = { ok: boolean; dryRun: boolean; result: Record<string, number> };

async function runJob(job: string, options: { dryRun?: boolean } = {}): Promise<JobBody> {
  const url = `http://localhost/api/jobs/${job}${options.dryRun ? "?dryRun=1" : ""}`;
  const response = await route.POST(
    new Request(url, { method: "POST", headers: { authorization: `Bearer ${cronSecret}` } }),
    { params: Promise.resolve({ job }) },
  );
  expect(response.status).toBe(200);
  return (await response.json()) as JobBody;
}

const sentTo = (address: string) => sent.filter((email) => email.to === address);

/** An appointment at 10:00 IST on the next IST day, the window the reminder job covers. */
async function appointmentTomorrow(clinicId: string, patientId: string): Promise<string> {
  const { rows } = await admin<{ id: string }>(
    `insert into public.appointments (clinic_id, patient_id, starts_at)
     values ($1, $2, (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day 10 hours') at time zone 'Asia/Kolkata')
     returning id`,
    [clinicId, patientId],
  );
  return rows[0]!.id;
}

async function patient(
  clinicId: string,
  fields: { email: string; emailConsent: boolean; optedOut?: boolean },
): Promise<string> {
  const { rows } = await admin<{ id: string }>(
    `insert into public.patients (clinic_id, full_name, email, email_consent, opted_out_at)
     values ($1, $2, $3, $4, case when $5 then now() end) returning id`,
    [clinicId, `Synthetic Surname${tag()}`, fields.email, fields.emailConsent, fields.optedOut ?? false],
  );
  return rows[0]!.id;
}

async function logRows(clinicId: string, kind: string): Promise<string[]> {
  const { rows } = await admin<{ subject_key: string }>(
    "select subject_key from public.notification_log where clinic_id = $1 and kind = $2",
    [clinicId, kind],
  );
  return rows.map((row) => row.subject_key);
}

beforeAll(async () => {
  proxy = await startRestProxy();
  process.env.SUPABASE_URL = proxy.url;
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local_integration_tests";
  // Locally minted service_role token stands in for the Supabase secret key.
  process.env.SUPABASE_SECRET_KEY = await mintToken({ role: "service_role" }, { expiresIn: "1h" });
  process.env.RESEND_API_KEY = `re_${randomBytes(12).toString("hex")}`;
  process.env.EMAIL_FROM = "ParmarPro <noreply@example.test>";
  process.env.CRON_SECRET = cronSecret;
  process.env.LINK_SIGNING_SECRET = randomBytes(32).toString("hex");
  route = await import("@/app/api/jobs/[job]/route");
  A = await createClinicFixture("JobsE2EA");
  B = await createClinicFixture("JobsE2EB");
});

afterAll(async () => {
  // Deleting the clinics also deletes their notification_log rows.
  await deleteClinicFixture(A);
  await deleteClinicFixture(B);
  await closePool();
  await proxy.close();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  sent = [];
  resendStatus = 200;
});

describe("patient reminders, end to end", () => {
  let consenting: string;
  let noConsent: string;
  let optedOut: string;
  let reminderOff: string;
  let consentingAppointment: string;

  beforeAll(async () => {
    await admin("update public.clinic_automation_settings set patient_email_reminders = true where clinic_id = $1", [A.id]);
    consenting = `consenting.${tag()}@example.test`;
    noConsent = `no-consent.${tag()}@example.test`;
    optedOut = `opted-out.${tag()}@example.test`;
    reminderOff = `reminders-off.${tag()}@example.test`;
    consentingAppointment = await appointmentTomorrow(A.id, await patient(A.id, { email: consenting, emailConsent: true }));
    await appointmentTomorrow(A.id, await patient(A.id, { email: noConsent, emailConsent: false }));
    await appointmentTomorrow(A.id, await patient(A.id, { email: optedOut, emailConsent: true, optedOut: true }));
    // Clinic B leaves reminder emails off (the default), so its consenting patient gets nothing.
    await appointmentTomorrow(B.id, await patient(B.id, { email: reminderOff, emailConsent: true }));
  });

  it("a dry run sends nothing and records nothing", async () => {
    const body = await runJob("patient-reminders", { dryRun: true });
    expect(body).toMatchObject({ ok: true, dryRun: true });
    expect(body.result.dry_run).toBeGreaterThanOrEqual(1);
    expect(sent).toHaveLength(0);
    expect(await logRows(A.id, "patient_reminder")).toEqual([]);
  });

  it("sends one reminder, only to the patient who consented, with a first name and an opt-out link", async () => {
    await runJob("patient-reminders");
    expect(sentTo(consenting)).toHaveLength(1);
    for (const address of [noConsent, optedOut, reminderOff]) expect(sentTo(address)).toHaveLength(0);

    const [email] = sentTo(consenting);
    expect(email!.subject).toBe(`Reminder: your appointment at Synthetic Clinic JobsE2EA`);
    expect(email!.text).toContain("Synthetic");
    expect(email!.text).not.toContain("Surname");
    expect(email!.text).toMatch(/\/email\/preferences\?t=/);
    expect(await logRows(A.id, "patient_reminder")).toEqual([consentingAppointment]);
  });

  it("a second run sends nothing", async () => {
    const body = await runJob("patient-reminders");
    expect(sentTo(consenting)).toHaveLength(0);
    expect(body.result.duplicate).toBeGreaterThanOrEqual(1);
    expect(await logRows(A.id, "patient_reminder")).toEqual([consentingAppointment]);
  });

  it("a send that Resend rejects is released and goes out on the next run", async () => {
    const retry = `retry.${tag()}@example.test`;
    const appointment = await appointmentTomorrow(A.id, await patient(A.id, { email: retry, emailConsent: true }));

    resendStatus = 500;
    const failed = await runJob("patient-reminders");
    expect(failed.result.failed).toBeGreaterThanOrEqual(1);
    expect(await logRows(A.id, "patient_reminder")).not.toContain(appointment);

    resendStatus = 200;
    sent = [];
    await runJob("patient-reminders");
    expect(sentTo(retry)).toHaveLength(1);
    expect(await logRows(A.id, "patient_reminder")).toContain(appointment);
  });
});

describe("staff digest, end to end", () => {
  beforeAll(async () => {
    await admin("update public.clinic_members set digest_opt_out = true where id = $1", [A.admin.memberId]);
    // The fixture's task is unassigned (the owner's count). Give the staff member one overdue task of their own,
    // since a digest with every count at zero is not sent.
    await admin(
      "insert into public.tasks (clinic_id, title, due_at, assigned_to) values ($1, 'Synthetic Lead call', now() - interval '1 hour', $2)",
      [A.id, A.staff.memberId],
    );
  });

  it("sends counts to the owner and the staff member, nothing to the viewer or to a member who opted out", async () => {
    await runJob("staff-digest");
    expect(sentTo(addressOf(A.owner.userId))).toHaveLength(1);
    expect(sentTo(addressOf(A.staff.userId))).toHaveLength(1);
    expect(sentTo(addressOf(A.viewer.userId))).toHaveLength(0);
    expect(sentTo(addressOf(A.admin.userId))).toHaveLength(0);
  });

  it("names no patient, lead or colleague", async () => {
    await admin("delete from public.notification_log where clinic_id = $1 and kind = 'staff_digest'", [A.id]);
    await runJob("staff-digest");
    const emails = [...sentTo(addressOf(A.owner.userId)), ...sentTo(addressOf(A.staff.userId))];
    expect(emails).toHaveLength(2);
    for (const email of emails) {
      for (const field of [email.subject, email.text, email.html]) {
        expect(field).not.toMatch(/Synthetic (Patient|Lead|Surname|owner|admin|staff|viewer)/);
      }
    }
  });

  it("a second run the same day sends nothing", async () => {
    await runJob("staff-digest");
    expect(sentTo(addressOf(A.owner.userId))).toHaveLength(0);
    expect(sentTo(addressOf(A.staff.userId))).toHaveLength(0);
  });
});

describe("trial notices, end to end", () => {
  beforeAll(async () => {
    await admin("update public.clinic_entitlements set trial_ends_at = now() + interval '5 days' where clinic_id = $1", [B.id]);
  });

  it("sends one trial reminder to the owner of a clinic whose trial ends in 5 days, and nothing on a second run", async () => {
    await runJob("trial-renewal");
    const owner = sentTo(addressOf(B.owner.userId));
    expect(owner).toHaveLength(1);
    expect(sentTo(addressOf(B.staff.userId))).toHaveLength(0);
    // Clinic A's trial ends in 14 days: no notice yet.
    expect(sentTo(addressOf(A.owner.userId))).toHaveLength(0);

    sent = [];
    await runJob("trial-renewal");
    expect(sentTo(addressOf(B.owner.userId))).toHaveLength(0);
  });
});

describe("job runs and the founder digest's operations section, end to end", () => {
  let handler: typeof import("@/server/jobs/handler");
  let ops: typeof import("@/server/privileged/ops");
  let startedAt: Date;

  beforeAll(async () => {
    startedAt = new Date(Date.now() - 1000);
    handler = await import("@/server/jobs/handler");
    ops = await import("@/server/privileged/ops");
  });

  afterAll(async () => {
    await admin("delete from public.job_runs where job in ('ops-string-test', 'ops-throw-test')");
    await admin("delete from public.ai_calls where feature = 'ops_note' and created_at >= $1", [startedAt]);
  });

  async function runCount(job: string): Promise<number> {
    const { rows } = await admin<{ n: string }>("select count(*)::text as n from public.job_runs where job = $1", [job]);
    return Number(rows[0]!.n);
  }

  async function lastRun(job: string) {
    const { rows } = await admin<{ ok: boolean; dry_run: boolean; result: Record<string, unknown>; duration_ms: number }>(
      "select ok, dry_run, result, duration_ms from public.job_runs where job = $1 order by id desc limit 1",
      [job],
    );
    return rows[0]!;
  }

  it("a run through the route records one job_runs row, with the counts and no other data", async () => {
    const before = await runCount("staff-digest");
    await runJob("staff-digest");

    expect(await runCount("staff-digest")).toBe(before + 1);
    const row = await lastRun("staff-digest");
    expect(row).toMatchObject({ ok: true, dry_run: false });
    expect(row.duration_ms).toBeGreaterThanOrEqual(0);
    for (const value of Object.values(row.result)) expect(["number", "boolean"]).toContain(typeof value);
  });

  it("a dry run is recorded as a dry run", async () => {
    await runJob("patient-reminders", { dryRun: true });
    expect(await lastRun("patient-reminders")).toMatchObject({ ok: true, dry_run: true });
  });

  it("a job whose result has a string value is recorded without that value", async () => {
    const response = await handler.handleJobRequest(
      new Request("http://localhost/api/jobs/ops-string-test", {
        method: "POST",
        headers: { authorization: `Bearer ${cronSecret}` },
      }),
      "ops-string-test",
      {
        registry: {
          "ops-string-test": async () => ({ processed: 2, failed: 1, ok: true, note: "Synthetic Patient Name" }),
        },
        secret: () => cronSecret,
        now: () => new Date(),
        record: ops.recordJobRun,
      },
    );

    expect(response.status).toBe(200);
    expect((await lastRun("ops-string-test")).result).toEqual({ processed: 2, failed: 1, ok: true });
  });

  it("a job that throws is recorded as not ok, with an empty result", async () => {
    const response = await handler.handleJobRequest(
      new Request("http://localhost/api/jobs/ops-throw-test", {
        method: "POST",
        headers: { authorization: `Bearer ${cronSecret}` },
      }),
      "ops-throw-test",
      {
        registry: {
          "ops-throw-test": async () => {
            throw new Error("connection to db.internal failed for Synthetic Patient");
          },
        },
        secret: () => cronSecret,
        now: () => new Date(),
        record: ops.recordJobRun,
      },
    );

    expect(response.status).toBe(500);
    expect(await lastRun("ops-throw-test")).toMatchObject({ ok: false, dry_run: false, result: {} });
  });

  it("the founder digest carries the operations section and the AI note, from a fake free-lane transport", async () => {
    const { createFounderDigestJob } = await import("@/server/jobs/founder-digest");
    const { enquiryManageUrl } = await import("@/server/jobs/links");
    const { founderEnquiries, founderMetrics } = await import("@/server/privileged/jobs");
    const { notifier } = await import("@/server/privileged/notifications");
    const { createOpsNote } = await import("@/server/ai/features/ops-note");
    const { createAiRunner } = await import("@/server/ai/run");
    const { reserveAiCall, settleAiCall } = await import("@/server/privileged/ai-usage");

    // The model's input, as the fake transport received it.
    const inputs: string[] = [];
    const transport: Transport = {
      async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
        inputs.push(req.input);
        return {
          ok: true,
          value: req.parse.parse({ attention: "high", note: "Check the job runs first." }),
          usage: null,
        };
      },
    };
    // The real reserve and settle run against the local database. Only the model is fake.
    const runner = createAiRunner({
      lane: "free",
      transport,
      reserve: reserveAiCall,
      settle: settleAiCall,
      clinicDailyCap: null,
    });

    const founder = `founder.${tag()}@example.test`;
    const now = new Date();
    await admin(
      "delete from public.notification_log where kind = 'founder_digest' and subject_key = 'founder' and period_key = $1",
      [istDateKey(now)],
    );

    const job = createFounderDigestJob({
      to: () => founder,
      enquiries: founderEnquiries,
      metrics: founderMetrics,
      ops: ops.opsCounts,
      opsNote: createOpsNote({ runner }),
      manageUrl: enquiryManageUrl,
      sendOnce: (params) => notifier().sendOnce(params),
    });

    // The failed run recorded above is in the last 24 hours, so operations need attention and the
    // digest is sent even on a day with no enquiries.
    expect(await job({ now, dryRun: false })).toMatchObject({ sent: 1, ai_note: 1 });

    const [email] = sentTo(founder);
    expect(email?.text).toContain("Operations (last 24 hours)");
    expect(email?.text).toContain("Suggested focus (AI): Check the job runs first.");
    expect(email?.html).toContain("Suggested focus (AI): Check the job runs first.");

    // The only text the free lane received: the fixed count keys, each with an integer.
    expect(inputs).toHaveLength(1);
    const sentToModel = JSON.parse(inputs[0]!) as Record<string, unknown>;
    expect(Object.keys(sentToModel)).toEqual([...OPS_COUNT_KEYS]);
    expect(Object.values(sentToModel).every((value) => Number.isInteger(value))).toBe(true);
  });
});
