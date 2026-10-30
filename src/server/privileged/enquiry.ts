import "server-only";

import { CONSENT_NOTE } from "@/lib/enquiry";
import { istDayStart } from "@/lib/ist";
import { privilegedDb } from "@/server/privileged/client";

/**
 * PRIVILEGED operations behind the public website enquiry form (/enquire/<key>).
 * They run with the service role because the visitor is anonymous. The clinic
 * key is the only lookup input, and the functions return only what the form
 * needs: the clinic's id and name, and the id of the lead they create.
 */

const KEY_PATTERN = /^[0-9a-f]{64}$/;

export type EnquiryClinic = { clinicId: string; clinicName: string; aiEnquiryHelp: boolean };

export type WebsiteLeadInput = {
  clinicId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  message: string | null;
};

/**
 * The clinic behind an enquiry key, when the form is on and the clinic is not
 * archived. Null in every other case, so the caller cannot tell a wrong key
 * from a switched-off form.
 */
export async function findEnquiryClinic(key: string): Promise<EnquiryClinic | null> {
  if (!KEY_PATTERN.test(key)) return null;
  const db = privilegedDb();
  const { data: settings, error } = await db
    .from("clinic_automation_settings")
    .select("clinic_id, ai_enquiry_help, clinics!inner(name, archived_at)")
    .eq("enquiry_form_key", key)
    .eq("enquiry_form_enabled", true)
    .maybeSingle();
  if (error) throw error;
  if (!settings || settings.clinics.archived_at !== null) return null;

  return { clinicId: settings.clinic_id, clinicName: settings.clinics.name, aiEnquiryHelp: settings.ai_enquiry_help };
}

/** Website enquiries the clinic has received today (IST), for the daily cap. */
export async function websiteEnquiriesToday(clinicId: string): Promise<number> {
  const { count, error } = await privilegedDb()
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("source", "website")
    .gte("created_at", istDayStart(new Date()).toISOString());
  if (error) throw error;
  return count ?? 0;
}

/**
 * Adds an enquiry to the clinic's leads as a new 'website' lead. Returns the lead
 * id. created_by and created_at come from the audit trigger: with the service
 * role there is no user, so the lead is recorded as created by the system.
 */
export async function createWebsiteLead(input: WebsiteLeadInput): Promise<string> {
  const notes = input.message ? `${input.message}\n\n${CONSENT_NOTE}` : CONSENT_NOTE;
  const { data, error } = await privilegedDb()
    .from("leads")
    .insert({
      clinic_id: input.clinicId,
      full_name: input.fullName,
      phone_e164: input.phone,
      email: input.email,
      source: "website",
      status: "new",
      notes,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
