/**
 * Integration: the privileged job queries against the local database (service
 * role -> PostgREST -> PostgreSQL). These checks cover the RPC wiring, the row
 * shapes and the single-row guards. The job logic itself is covered by the unit tests.
 */
import { randomBytes, randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { istDateKey } from "@/lib/ist";

import { admin, closePool, createClinicFixture, deleteClinicFixture, type ClinicFixture } from "../helpers/db";
import { mintToken } from "../helpers/jwt";
import { startRestProxy } from "../helpers/rest-proxy";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

let A: ClinicFixture;
let proxy: Awaited<ReturnType<typeof startRestProxy>>;
let jobs: typeof import("@/server/privileged/jobs");
let billing: typeof import("@/server/privileged/billing");
const contactIds: string[] = [];

const tag = () => randomBytes(6).toString("hex");

beforeAll(async () => {
  proxy = await startRestProxy();
  process.env.SUPABASE_URL = proxy.url;
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_local_integration_tests";
  // Locally minted service_role token stands in for the Supabase secret key.
  process.env.SUPABASE_SECRET_KEY = await mintToken({ role: "service_role" }, { expiresIn: "1h" });
  jobs = await import("@/server/privileged/jobs");
  billing = await import("@/server/privileged/billing");
  A = await createClinicFixture("Jobs");
});

afterAll(async () => {
  if (contactIds.length > 0) await admin("delete from public.contact_requests where id = any($1::uuid[])", [contactIds]);
  await deleteClinicFixture(A);
  await closePool();
  await proxy.close();
});

async function insertContactRequest(createdAt: string, followUpAt: string | null, handledAt: string | null): Promise<string> {
  const { rows } = await admin<{ id: string }>(
    `insert into public.contact_requests (full_name, clinic_name, email, city, created_at, follow_up_at, handled_at)
     values ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::timestamptz) returning id`,
    [
      `Synthetic Enquirer ${tag()}`,
      "Synthetic Clinic",
      `enquirer.${tag()}@example.test`,
      "Pune",
      createdAt,
      followUpAt,
      handledAt,
    ],
  );
  const id = rows[0]!.id;
  contactIds.push(id);
  return id;
}

describe("staff digest rows", () => {
  it("list the staff member, and only owners and admins see unassigned work", async () => {
    const rows = await jobs.staffDigestRows(new Date());
    const staff = rows.find((row) => row.member_id === A.staff.memberId);
    const owner = rows.find((row) => row.member_id === A.owner.memberId);
    expect(staff).toMatchObject({
      clinic_id: A.id,
      clerk_user_id: A.staff.userId,
      member_role: "staff",
      unassigned_open_tasks: 0,
    });
    // The fixture's only task has no assignee and is already due, so the owner sees it as unassigned.
    expect(owner).toMatchObject({ member_role: "owner", unassigned_open_tasks: 1 });
  });
});

describe("entitlement notice rows", () => {
  it("give a trial_reminder to the owner of a clinic whose trial ends in 5 days", async () => {
    await admin("update public.clinic_entitlements set trial_ends_at = now() + interval '5 days' where clinic_id = $1", [A.id]);
    const rows = await jobs.entitlementNoticeRows(new Date());
    const row = rows.find((candidate) => candidate.clinic_id === A.id);
    expect(row).toMatchObject({ notice: "trial_reminder", days_left: 5, owner_user_ids: [A.owner.userId] });
    expect(row?.period_key).toBe(`trial_reminder:${istDateKey(new Date(Date.now() + 5 * DAY_MS))}`);
  });
});

describe("founder enquiries", () => {
  it("lists a new request as fresh, an old unanswered one as unanswered, a passed follow-up as due, and leaves handled ones out", async () => {
    const now = new Date();
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    const fresh = await insertContactRequest(now.toISOString(), null, null);
    const unanswered = await insertContactRequest(ago(3 * DAY_MS), null, null);
    const due = await insertContactRequest(ago(3 * DAY_MS), ago(HOUR_MS), null);
    const handled = await insertContactRequest(ago(3 * DAY_MS), null, now.toISOString());

    const result = await jobs.founderEnquiries(now);
    const ids = (list: { id: string }[]) => list.map((row) => row.id);

    expect(ids(result.fresh)).toContain(fresh);
    expect(ids(result.fresh)).not.toContain(unanswered);
    expect(ids(result.unanswered)).toContain(unanswered);
    expect(ids(result.unanswered)).not.toContain(due);
    expect(ids(result.dueFollowUps)).toContain(due);
    for (const list of [result.fresh, result.dueFollowUps, result.unanswered]) {
      expect(ids(list)).not.toContain(handled);
    }
  });
});

describe("stale billing orders", () => {
  it("lists an order unpaid for more than 15 minutes, expires it once, and does not list it afterwards", async () => {
    const id = randomUUID();
    await admin(
      `insert into public.billing_orders (id, clinic_id, provider_order_id, plan_code, period_months, base_paise, gst_paise,
                                          amount_paise, created_by, created_at)
       values ($1, $2, $3, 'parmarpro_clinic_monthly', 1, 7500000, 1350000, 8850000, $4, now() - interval '30 days')`,
      [id, A.id, `order_${tag()}`, A.owner.userId],
    );

    const stale = await jobs.staleBillingOrders(new Date());
    expect(stale.find((order) => order.id === id)).toMatchObject({ clinic_id: A.id });

    await expect(jobs.expireBillingOrder(id)).resolves.toBe(true);
    await expect(jobs.expireBillingOrder(id)).resolves.toBe(false);
    const { rows } = await admin<{ status: string }>("select status from public.billing_orders where id = $1", [id]);
    expect(rows[0]?.status).toBe("expired");
    expect((await jobs.staleBillingOrders(new Date())).some((order) => order.id === id)).toBe(false);
  });

  it("does not list an order created just now", async () => {
    const id = randomUUID();
    await billing.recordBillingOrder({
      id,
      clinicId: A.id,
      providerOrderId: `order_${tag()}`,
      planCode: "parmarpro_clinic_monthly",
      basePaise: 7_500_000,
      gstPaise: 1_350_000,
      amountPaise: 8_850_000,
      createdBy: A.owner.userId,
    });
    expect((await jobs.staleBillingOrders(new Date())).some((order) => order.id === id)).toBe(false);
  });
});

describe("expired invitations", () => {
  it("lists a pending invitation older than 7 days with its Clerk organization, and expires it once", async () => {
    const suffix = tag();
    const { rows } = await admin<{ id: string }>(
      `insert into public.clinic_invitations (clinic_id, email, role, clerk_invitation_id, invited_by, created_at)
       values ($1, $2, 'staff', $3, $4, now() - interval '8 days') returning id`,
      [A.id, `invitee.${suffix}@example.test`, `orginv_${suffix}`, A.owner.userId],
    );
    const id = rows[0]!.id;

    const expired = await jobs.expiredInvitations(new Date());
    expect(expired.find((invitation) => invitation.id === id)).toEqual({
      id,
      clinic_id: A.id,
      clerk_invitation_id: `orginv_${suffix}`,
      invited_by: A.owner.userId,
      clerk_org_id: A.orgId,
    });

    await expect(jobs.markInvitationExpired(id)).resolves.toBe(true);
    await expect(jobs.markInvitationExpired(id)).resolves.toBe(false);
    const status = await admin<{ status: string }>("select status from public.clinic_invitations where id = $1", [id]);
    expect(status.rows[0]?.status).toBe("expired");
  });
});

describe("patient reminder rows", () => {
  it("list tomorrow's appointment of a patient who consented to email, once the clinic has reminders on", async () => {
    const email = `patient.${tag()}@example.test`;
    await admin("update public.patients set email = $2, email_consent = true where id = $1", [A.patientId, email]);
    await admin("update public.clinic_automation_settings set patient_email_reminders = true where clinic_id = $1", [A.id]);
    await admin(
      `update public.appointments
          set starts_at = ((date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day 10 hours')
                           at time zone 'Asia/Kolkata')
        where id = $1`,
      [A.appointmentId],
    );

    const rows = await jobs.patientReminderRows(new Date());
    expect(rows.find((row) => row.appointment_id === A.appointmentId)).toMatchObject({
      clinic_id: A.id,
      first_name: "Synthetic",
      email,
    });
  });
});

describe("weekly summary and founder metrics", () => {
  it("weekly summary rows give the owner and the dashboard counters for the clinic", async () => {
    const rows = await jobs.weeklySummaryRows(new Date(Date.now() - 7 * DAY_MS), new Date());
    const row = rows.find((candidate) => candidate.clinic_id === A.id);
    expect(row?.owner_user_ids).toEqual([A.owner.userId]);
    expect(row?.summary).toMatchObject({ leads_created: 1, patients_total: 1 });
  });

  it("founder metrics return the six counters as numbers", async () => {
    const metrics = await jobs.founderMetrics(new Date(Date.now() - 30 * DAY_MS), new Date());
    expect(Object.keys(metrics).sort()).toEqual(
      ["clinics_created", "enquiries", "paid_active", "payments_captured", "revenue_paise", "trials_active"],
    );
    for (const value of Object.values(metrics)) expect(typeof value).toBe("number");
    expect(metrics.clinics_created).toBeGreaterThanOrEqual(1);
  });
});
