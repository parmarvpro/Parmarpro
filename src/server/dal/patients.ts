import "server-only";

import { patientFiltersSchema, patientInputSchema, uuidField, type PatientFilters } from "@/lib/validation/entities";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/auth/errors";
import { throwIfDbError } from "@/server/db/errors";
import { pageRange, searchFilter } from "@/server/dal/shared";
import { parseInput } from "@/server/validation";

export async function listPatients(rawFilters: unknown) {
  const ctx = await requirePermission("patient:read");
  const filters: PatientFilters = patientFiltersSchema.parse(rawFilters ?? {});
  const { from, to } = pageRange(filters.page);
  let query = ctx.db
    .from("patients")
    .select("id, full_name, phone_e164, email, whatsapp_consent, sms_consent, email_consent, opted_out_at, archived_at, created_at", {
      count: "exact",
    });
  if (filters.q) {
    const { column, pattern } = searchFilter(filters.q);
    query = query.ilike(column, pattern);
  }
  if (filters.archived === "only") query = query.not("archived_at", "is", null);
  else if (filters.archived !== "include") query = query.is("archived_at", null);
  const { data, error, count } = await query.order("full_name", { ascending: true }).range(from, to);
  throwIfDbError(error);
  return { rows: data ?? [], total: count ?? 0, filters };
}

export async function getPatient(rawId: unknown) {
  const ctx = await requirePermission("patient:read");
  const id = parseInput(uuidField, rawId);
  const { data, error } = await ctx.db
    .from("patients")
    .select("id, full_name, phone_e164, email, whatsapp_consent, sms_consent, email_consent, consent_recorded_at, opted_out_at, archived_at, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new AppError("not_found");
  const [appointments, leads, tasks] = await Promise.all([
    ctx.db.from("appointments").select("id, starts_at, status, appointment_type").eq("patient_id", id).order("starts_at", { ascending: false }).limit(50),
    ctx.db.from("leads").select("id, full_name, status, source, created_at").eq("patient_id", id).order("created_at", { ascending: false }),
    ctx.db.from("tasks").select("id, title, status, due_at").eq("patient_id", id).order("created_at", { ascending: false }).limit(50),
  ]);
  throwIfDbError(appointments.error);
  throwIfDbError(leads.error);
  throwIfDbError(tasks.error);
  return { patient: data, appointments: appointments.data ?? [], leads: leads.data ?? [], tasks: tasks.data ?? [], role: ctx.role };
}

function toRow(input: ReturnType<typeof patientInputSchema.parse>, existing?: { opted_out_at: string | null; consent_recorded_at: string | null; whatsapp_consent: boolean; sms_consent: boolean; email_consent: boolean }) {
  const now = new Date().toISOString();
  const consentChanged =
    !existing ||
    existing.whatsapp_consent !== input.whatsappConsent ||
    existing.sms_consent !== input.smsConsent ||
    existing.email_consent !== input.emailConsent;
  const anyConsent = input.whatsappConsent || input.smsConsent || input.emailConsent;
  return {
    full_name: input.fullName,
    phone_e164: input.phone,
    email: input.email,
    whatsapp_consent: input.whatsappConsent,
    sms_consent: input.smsConsent,
    email_consent: input.emailConsent,
    consent_recorded_at: consentChanged ? (anyConsent ? now : null) : (existing?.consent_recorded_at ?? null),
    opted_out_at: input.optedOut ? (existing?.opted_out_at ?? now) : null,
  };
}

export async function createPatient(rawInput: unknown): Promise<{ id: string }> {
  const ctx = await requirePermission("patient:create");
  const input = parseInput(patientInputSchema, rawInput);
  const { data, error } = await ctx.db.from("patients").insert(toRow(input)).select("id").single();
  throwIfDbError(error);
  return data!;
}

export async function updatePatient(rawId: unknown, rawInput: unknown): Promise<void> {
  const ctx = await requirePermission("patient:update");
  const id = parseInput(uuidField, rawId);
  const input = parseInput(patientInputSchema, rawInput);
  const { data: existing, error: readError } = await ctx.db
    .from("patients")
    .select("opted_out_at, consent_recorded_at, whatsapp_consent, sms_consent, email_consent")
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(readError);
  if (!existing) throw new AppError("not_found");
  const { data, error } = await ctx.db.from("patients").update(toRow(input, existing)).eq("id", id).select("id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}

export async function setPatientArchived(rawId: unknown, archived: boolean): Promise<void> {
  const ctx = await requirePermission("patient:archive");
  const id = parseInput(uuidField, rawId);
  const { data, error } = await ctx.db
    .from("patients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}

/** Minimal list for pickers (appointment and task forms). */
export async function listPatientOptions() {
  const ctx = await requirePermission("patient:read");
  const { data, error } = await ctx.db
    .from("patients")
    .select("id, full_name, phone_e164")
    .is("archived_at", null)
    .order("full_name")
    .limit(500);
  throwIfDbError(error);
  return data ?? [];
}
