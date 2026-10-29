import "server-only";

import { istDayBounds } from "@/lib/time";
import {
  appointmentCreateSchema,
  appointmentFiltersSchema,
  appointmentStatusSchema,
  appointmentUpdateSchema,
  uuidField,
  type AppointmentFilters,
} from "@/lib/validation/entities";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/auth/errors";
import { throwIfDbError } from "@/server/db/errors";
import { pageRange } from "@/server/dal/shared";
import { parseInput } from "@/server/validation";

const LIST_COLUMNS =
  "id, starts_at, duration_minutes, appointment_type, status, notes, cancel_reason, assigned_to, patient:patients(id, full_name, phone_e164, whatsapp_consent, opted_out_at), lead:leads(id, full_name, phone_e164), assignee:clinic_members(id, display_name, role)";

export async function listAppointments(rawFilters: unknown) {
  const ctx = await requirePermission("appointment:read");
  const filters: AppointmentFilters = appointmentFiltersSchema.parse(rawFilters ?? {});
  const { from, to } = pageRange(filters.page);
  const today = istDayBounds();
  let query = ctx.db.from("appointments").select(LIST_COLUMNS, { count: "exact" });
  switch (filters.range) {
    case "today":
      query = query.gte("starts_at", today.start).lt("starts_at", today.end).order("starts_at");
      break;
    case "upcoming":
      query = query.gte("starts_at", today.start).order("starts_at");
      break;
    case "past":
      query = query.lt("starts_at", today.start).order("starts_at", { ascending: false });
      break;
    case "all":
      query = query.order("starts_at", { ascending: false });
      break;
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.assignee === "me") query = query.eq("assigned_to", ctx.memberId);
  else if (filters.assignee) query = query.eq("assigned_to", filters.assignee);
  const { data, error, count } = await query.range(from, to);
  throwIfDbError(error);
  const now = Date.now();
  const rows = (data ?? []).map((appointment) => {
    const upcoming =
      (appointment.status === "scheduled" || appointment.status === "confirmed") && Date.parse(appointment.starts_at) > now;
    const patient = appointment.patient;
    // A WhatsApp reminder is offered only for an upcoming visit whose patient has a phone and agreed to WhatsApp.
    const whatsappReminderDue = Boolean(
      upcoming && patient?.phone_e164 && patient.whatsapp_consent && patient.opted_out_at === null,
    );
    return { ...appointment, whatsappReminderDue };
  });
  return { rows, total: count ?? 0, filters, role: ctx.role };
}

export async function createAppointment(rawInput: unknown): Promise<{ id: string; appointmentType: string; fromLead: boolean }> {
  const ctx = await requirePermission("appointment:create");
  const input = parseInput(appointmentCreateSchema, rawInput);
  const { data, error } = await ctx.db
    .from("appointments")
    .insert({
      patient_id: input.patientId,
      lead_id: input.leadId,
      starts_at: input.startsAt,
      duration_minutes: input.durationMinutes,
      appointment_type: input.appointmentType,
      assigned_to: input.assignedTo,
      notes: input.notes,
    })
    .select("id")
    .single();
  throwIfDbError(error);
  if (input.leadId) {
    // Move an open inquiry forward; ignore leads already converted or lost.
    const { error: leadError } = await ctx.db
      .from("leads")
      .update({ status: "appointment_booked" })
      .eq("id", input.leadId)
      .in("status", ["new", "contacted", "qualified"]);
    throwIfDbError(leadError);
  }
  return { id: data!.id, appointmentType: input.appointmentType, fromLead: Boolean(input.leadId) };
}

/** Reschedule / edit details. The database rejects edits to closed appointments. */
export async function updateAppointment(rawId: unknown, rawInput: unknown): Promise<void> {
  const ctx = await requirePermission("appointment:update");
  const id = parseInput(uuidField, rawId);
  const input = parseInput(appointmentUpdateSchema, rawInput);
  const { data, error } = await ctx.db
    .from("appointments")
    .update({
      starts_at: input.startsAt,
      duration_minutes: input.durationMinutes,
      appointment_type: input.appointmentType,
      assigned_to: input.assignedTo,
      notes: input.notes,
    })
    .eq("id", id)
    .select("id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}

export async function setAppointmentStatus(rawId: unknown, rawInput: unknown): Promise<void> {
  const ctx = await requirePermission("appointment:update");
  const id = parseInput(uuidField, rawId);
  const input = parseInput(appointmentStatusSchema, rawInput);
  const { data, error } = await ctx.db
    .from("appointments")
    .update({ status: input.status, cancel_reason: input.status === "cancelled" ? input.cancelReason : null })
    .eq("id", id)
    .select("id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}

export async function deleteAppointment(rawId: unknown): Promise<void> {
  const ctx = await requirePermission("appointment:delete");
  const id = parseInput(uuidField, rawId);
  const { data, error } = await ctx.db.from("appointments").delete().eq("id", id).select("id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}
