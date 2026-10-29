import "server-only";

import { automationSettingsSchema, digestOptOutSchema } from "@/lib/validation/automations";
import { getAuthContext, requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/auth/errors";
import { throwIfDbError } from "@/server/db/errors";
import { parseInput } from "@/server/validation";

/**
 * Clinic automation settings. Owners and admins change them (clinic:update);
 * every member can read them (clinic:read) and change their own staff digest
 * preference. RLS enforces the same rules again. The round-robin cursor and the
 * enquiry key's internals are never selected here.
 */

const SETTINGS_COLUMNS =
  "morning_digest, weekly_summary, untouched_lead_tasks, untouched_lead_hours, no_show_tasks, round_robin, recall_tasks, recall_months, patient_email_reminders, enquiry_form_enabled, enquiry_form_key";

export async function getAutomationSettings() {
  const ctx = await requirePermission("clinic:read");
  const { data, error } = await ctx.db
    .from("clinic_automation_settings")
    .select(SETTINGS_COLUMNS)
    .eq("clinic_id", ctx.clinicId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new AppError("not_found");
  return { settings: data, role: ctx.role };
}

/** Whether the caller has turned off the staff morning digest for themselves. */
export async function getMyDigestOptOut(): Promise<boolean> {
  const ctx = await getAuthContext();
  const { data, error } = await ctx.db
    .from("clinic_members")
    .select("digest_opt_out")
    .eq("clinic_id", ctx.clinicId)
    .eq("clerk_user_id", ctx.userId)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new AppError("not_found");
  return data.digest_opt_out;
}

export async function updateAutomationSettings(rawInput: unknown): Promise<void> {
  const ctx = await requirePermission("clinic:update");
  const input = parseInput(automationSettingsSchema, rawInput);
  const { data, error } = await ctx.db
    .from("clinic_automation_settings")
    .update(input)
    .eq("clinic_id", ctx.clinicId)
    .select("clinic_id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}

/** Replaces the public enquiry link. The previous link stops working at once. */
export async function regenerateEnquiryFormKey(): Promise<void> {
  const ctx = await requirePermission("clinic:update");
  const { error } = await ctx.db.rpc("regenerate_enquiry_form_key");
  throwIfDbError(error);
}

/** Turns the staff morning digest on or off for the caller only. */
export async function setMyDigestOptOut(rawOptOut: unknown): Promise<void> {
  const ctx = await getAuthContext();
  const optOut = parseInput(digestOptOutSchema, rawOptOut);
  const { error } = await ctx.db.rpc("set_my_digest_opt_out", { p_opt_out: optOut });
  throwIfDbError(error);
}
