import "server-only";

import type { Database, Json } from "@/server/db/database.types";
import type { FounderMetrics, WeeklySummary } from "@/server/email/templates";
import { privilegedDb } from "@/server/privileged/client";

/**
 * PRIVILEGED queries for the scheduled jobs (src/server/jobs). They run with the
 * service role, so they see every clinic. Reads select only the columns a job
 * needs. Writes change one row and only from the status they expect, so a retry
 * or a concurrent change cannot apply the same transition twice.
 */

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const ENQUIRY_COLUMNS = "id, full_name, clinic_name, city, created_at";
const ENQUIRY_LIST_LIMIT = 50;

type JobFunctions = Database["public"]["Functions"];

export type StaffDigestRow = JobFunctions["job_staff_digest"]["Returns"][number];
export type PatientReminderRow = JobFunctions["job_patient_reminders"]["Returns"][number];
export type EntitlementNoticeRow = JobFunctions["job_entitlement_notices"]["Returns"][number];

export type WeeklySummaryRow = {
  clinic_id: string;
  clinic_name: string;
  owner_user_ids: string[];
  summary: WeeklySummary;
};

export type StaleBillingOrder = {
  id: string;
  clinic_id: string;
  provider_order_id: string;
  created_at: string;
};

export type ExpirableInvitation = {
  id: string;
  clinic_id: string;
  clerk_invitation_id: string | null;
  invited_by: string;
  clerk_org_id: string;
};

export type EnquiryRow = {
  id: string;
  full_name: string;
  clinic_name: string | null;
  city: string | null;
  created_at: string;
};

export type FounderEnquiries = {
  fresh: EnquiryRow[];
  dueFollowUps: EnquiryRow[];
  unanswered: EnquiryRow[];
};

/** ISO timestamp `ms` before `now`. */
function ago(now: Date, ms: number): string {
  return new Date(now.getTime() - ms).toISOString();
}

/** Orders still unpaid 15 minutes after they were created, oldest first. */
export async function staleBillingOrders(now: Date, limit = 50): Promise<StaleBillingOrder[]> {
  const { data, error } = await privilegedDb()
    .from("billing_orders")
    .select("id, clinic_id, provider_order_id, created_at")
    .eq("status", "created")
    .lte("created_at", ago(now, 15 * MINUTE_MS))
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

/** Marks an unpaid order expired. False when the order was no longer 'created' (for example, it was paid meanwhile). */
export async function expireBillingOrder(id: string): Promise<boolean> {
  const { data, error } = await privilegedDb()
    .from("billing_orders")
    .update({ status: "expired" })
    .eq("id", id)
    .eq("status", "created")
    .select("id");
  if (error) throw error;
  return data.length > 0;
}

/** Pending invitations older than 7 days, oldest first, with the Clerk organization they belong to. */
export async function expiredInvitations(now: Date, limit = 100): Promise<ExpirableInvitation[]> {
  const { data, error } = await privilegedDb()
    .from("clinic_invitations")
    .select("id, clinic_id, clerk_invitation_id, invited_by, clinics!inner(clerk_org_id)")
    .eq("status", "pending")
    .lte("created_at", ago(now, 7 * DAY_MS))
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    clinic_id: row.clinic_id,
    clerk_invitation_id: row.clerk_invitation_id,
    invited_by: row.invited_by,
    clerk_org_id: row.clinics.clerk_org_id,
  }));
}

/** Marks a pending invitation expired. False when it was no longer pending. */
export async function markInvitationExpired(id: string): Promise<boolean> {
  const { data, error } = await privilegedDb()
    .from("clinic_invitations")
    .update({ status: "expired" })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  return data.length > 0;
}

export async function staffDigestRows(now: Date): Promise<StaffDigestRow[]> {
  const { data, error } = await privilegedDb().rpc("job_staff_digest", { p_now: now.toISOString() });
  if (error) throw error;
  return data;
}

export async function patientReminderRows(now: Date): Promise<PatientReminderRow[]> {
  const { data, error } = await privilegedDb().rpc("job_patient_reminders", { p_now: now.toISOString() });
  if (error) throw error;
  return data;
}

export async function entitlementNoticeRows(now: Date): Promise<EntitlementNoticeRow[]> {
  const { data, error } = await privilegedDb().rpc("job_entitlement_notices", { p_now: now.toISOString() });
  if (error) throw error;
  return data;
}

export async function weeklySummaryRows(from: Date, to: Date): Promise<WeeklySummaryRow[]> {
  const { data, error } = await privilegedDb().rpc("job_weekly_summary", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw error;
  return data.map((row) => ({
    clinic_id: row.clinic_id,
    clinic_name: row.clinic_name,
    owner_user_ids: row.owner_user_ids,
    summary: parseWeeklySummary(row.summary),
  }));
}

export async function founderMetrics(from: Date, to: Date): Promise<FounderMetrics> {
  const { data, error } = await privilegedDb().rpc("job_founder_metrics", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw error;
  return parseFounderMetrics(data);
}

/**
 * Enquiries for the founder digest, newest first, at most 50 per list:
 * - fresh: received in the last 24 hours;
 * - dueFollowUps: not handled and the follow-up time has passed;
 * - unanswered: not handled, no follow-up set, received 1 to 14 days ago.
 */
export async function founderEnquiries(now: Date): Promise<FounderEnquiries> {
  const db = privilegedDb();
  const dayAgo = ago(now, DAY_MS);
  const [fresh, dueFollowUps, unanswered] = await Promise.all([
    db
      .from("contact_requests")
      .select(ENQUIRY_COLUMNS)
      .is("handled_at", null)
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: false })
      .limit(ENQUIRY_LIST_LIMIT),
    db
      .from("contact_requests")
      .select(ENQUIRY_COLUMNS)
      .is("handled_at", null)
      .lte("follow_up_at", now.toISOString())
      .order("created_at", { ascending: false })
      .limit(ENQUIRY_LIST_LIMIT),
    db
      .from("contact_requests")
      .select(ENQUIRY_COLUMNS)
      .is("handled_at", null)
      .is("follow_up_at", null)
      .lt("created_at", dayAgo)
      .gte("created_at", ago(now, 14 * DAY_MS))
      .order("created_at", { ascending: false })
      .limit(ENQUIRY_LIST_LIMIT),
  ]);
  if (fresh.error) throw fresh.error;
  if (dueFollowUps.error) throw dueFollowUps.error;
  if (unanswered.error) throw unanswered.error;
  return { fresh: fresh.data, dueFollowUps: dueFollowUps.data, unanswered: unanswered.data };
}

// The RPCs return jsonb. Their shape is checked here, so a changed query fails the job instead of sending wrong numbers.

type JsonObject = { [key: string]: Json | undefined };

function asObject(value: Json): JsonObject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("job_rpc_shape");
  return value;
}

function numberField(object: JsonObject, key: string): number {
  const value = object[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("job_rpc_shape");
  return value;
}

function parseWeeklySummary(value: Json): WeeklySummary {
  const o = asObject(value);
  return {
    leads_created: numberField(o, "leads_created"),
    leads_converted: numberField(o, "leads_converted"),
    appointments_in_range: numberField(o, "appointments_in_range"),
    tasks_completed: numberField(o, "tasks_completed"),
    tasks_overdue: numberField(o, "tasks_overdue"),
    follow_ups_due: numberField(o, "follow_ups_due"),
    patients_total: numberField(o, "patients_total"),
  };
}

function parseFounderMetrics(value: Json): FounderMetrics {
  const o = asObject(value);
  return {
    clinics_created: numberField(o, "clinics_created"),
    trials_active: numberField(o, "trials_active"),
    paid_active: numberField(o, "paid_active"),
    payments_captured: numberField(o, "payments_captured"),
    revenue_paise: numberField(o, "revenue_paise"),
    enquiries: numberField(o, "enquiries"),
  };
}
