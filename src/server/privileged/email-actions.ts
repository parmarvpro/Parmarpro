import "server-only";

import { z } from "zod";

import { privilegedDb } from "@/server/privileged/client";

/**
 * PRIVILEGED operations behind the email links and the automation emails. They
 * run with the service role. Callers verify the signed link (or the webhook or
 * payment) before calling, and every function here takes only the ids it needs.
 * Patient names and emails never leave this module.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_REMINDER_DAYS = 90;
const uuid = z.uuid();

function isUuid(value: string): boolean {
  return uuid.safeParse(value).success;
}

export type EnquiryDetail = {
  id: string;
  full_name: string;
  clinic_name: string | null;
  phone_e164: string | null;
  email: string | null;
  city: string | null;
  message: string | null;
  created_at: string;
  handled_at: string | null;
  follow_up_at: string | null;
};

const ENQUIRY_DETAIL_COLUMNS = "id, full_name, clinic_name, phone_e164, email, city, message, created_at, handled_at, follow_up_at";

/** One enquiry for the enquiry page. Null when the id is malformed or no row exists. */
export async function getEnquiry(id: string): Promise<EnquiryDetail | null> {
  if (!isUuid(id)) return null;
  const { data, error } = await privilegedDb().from("contact_requests").select(ENQUIRY_DETAIL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/** Marks an enquiry answered and clears any reminder. False when no enquiry has this id. */
export async function markEnquiryAnswered(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { data, error } = await privilegedDb()
    .from("contact_requests")
    .update({ handled_at: new Date().toISOString(), follow_up_at: null })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return data.length > 0;
}

/** Sets a follow-up `days` from now and leaves the enquiry unhandled. False when no enquiry has this id. */
export async function remindEnquiryLater(id: string, days: number): Promise<boolean> {
  if (!isUuid(id)) return false;
  if (!Number.isInteger(days) || days < 1 || days > MAX_REMINDER_DAYS) throw new Error("reminder period out of range");
  const { data, error } = await privilegedDb()
    .from("contact_requests")
    .update({ follow_up_at: new Date(Date.now() + days * DAY_MS).toISOString() })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return data.length > 0;
}

/** Turns off the staff morning digest for one member. False when no member has this id. */
export async function optOutDigest(memberId: string): Promise<boolean> {
  if (!isUuid(memberId)) return false;
  const { data, error } = await privilegedDb().from("clinic_members").update({ digest_opt_out: true }).eq("id", memberId).select("id");
  if (error) throw error;
  return data.length > 0;
}

async function clinicNameById(clinicId: string): Promise<string | null> {
  const { data, error } = await privilegedDb().from("clinics").select("name").eq("id", clinicId).maybeSingle();
  if (error) throw error;
  return data?.name ?? null;
}

/** Name of the clinic that owns an appointment, for display on the preferences page. */
export async function appointmentClinicName(appointmentId: string): Promise<string | null> {
  if (!isUuid(appointmentId)) return null;
  const { data, error } = await privilegedDb().from("appointments").select("clinic_id").eq("id", appointmentId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return clinicNameById(data.clinic_id);
}

/**
 * Stops appointment reminder emails for the patient of an appointment. Returns
 * only the clinic name, or null when the appointment has no patient or no
 * consent row could be updated.
 */
export async function optOutPatientEmails(appointmentId: string): Promise<{ clinicName: string } | null> {
  if (!isUuid(appointmentId)) return null;
  const db = privilegedDb();
  const { data: appointment, error } = await db
    .from("appointments")
    .select("clinic_id, patient_id")
    .eq("id", appointmentId)
    .maybeSingle();
  if (error) throw error;
  if (!appointment?.patient_id) return null;

  const clinicName = await clinicNameById(appointment.clinic_id);
  if (clinicName === null) return null;

  const { data: patients, error: updateError } = await db
    .from("patients")
    .update({ email_consent: false, consent_recorded_at: new Date().toISOString() })
    .eq("clinic_id", appointment.clinic_id)
    .eq("id", appointment.patient_id)
    .select("id");
  if (updateError) throw updateError;
  return patients.length > 0 ? { clinicName } : null;
}

/** A clinic's name and the Clerk user ids of its active owners, oldest membership first. Null when the clinic does not exist. */
export async function clinicOwnersAndName(clinicId: string): Promise<{ clinicName: string; ownerUserIds: string[] } | null> {
  if (!isUuid(clinicId)) return null;
  const clinicName = await clinicNameById(clinicId);
  if (clinicName === null) return null;
  const { data, error } = await privilegedDb()
    .from("clinic_members")
    .select("clerk_user_id")
    .eq("clinic_id", clinicId)
    .eq("role", "owner")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return { clinicName, ownerUserIds: data.map((row) => row.clerk_user_id) };
}

/** When the clinic's free trial ends, or null when the clinic has no trial date. */
export async function clinicTrialEndsAt(clinicId: string): Promise<Date | null> {
  if (!isUuid(clinicId)) return null;
  const { data, error } = await privilegedDb().from("clinic_entitlements").select("trial_ends_at").eq("clinic_id", clinicId).maybeSingle();
  if (error) throw error;
  return data?.trial_ends_at ? new Date(data.trial_ends_at) : null;
}

/** Number of enquiry auto-replies recorded in the notification log since `since`. */
export async function autoRepliesSentSince(since: Date): Promise<number> {
  const { count, error } = await privilegedDb()
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("kind", "enquiry_auto_reply")
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}
