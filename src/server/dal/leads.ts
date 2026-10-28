import "server-only";

import { istDayBounds } from "@/lib/time";
import { leadFiltersSchema, leadInputSchema, uuidField, type LeadFilters } from "@/lib/validation/entities";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/auth/errors";
import { throwIfDbError } from "@/server/db/errors";
import { pageRange, searchFilter } from "@/server/dal/shared";
import { parseInput } from "@/server/validation";

const LIST_COLUMNS =
  "id, full_name, phone_e164, source, status, next_follow_up_at, created_at, assigned_to, patient_id, assignee:clinic_members(id, display_name, role)";

export async function listLeads(rawFilters: unknown) {
  const ctx = await requirePermission("lead:read");
  const filters: LeadFilters = leadFiltersSchema.parse(rawFilters ?? {});
  const { from, to } = pageRange(filters.page);

  let query = ctx.db.from("leads").select(LIST_COLUMNS, { count: "exact" });
  if (filters.q) {
    const { column, pattern } = searchFilter(filters.q);
    query = query.ilike(column, pattern);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.assignee === "me") query = query.eq("assigned_to", ctx.memberId);
  else if (filters.assignee === "unassigned") query = query.is("assigned_to", null);
  else if (filters.assignee) query = query.eq("assigned_to", filters.assignee);
  if (filters.followUp) {
    const today = istDayBounds();
    query = query.not("status", "in", "(converted,lost)");
    if (filters.followUp === "overdue") query = query.lt("next_follow_up_at", today.start);
    if (filters.followUp === "today") query = query.gte("next_follow_up_at", today.start).lt("next_follow_up_at", today.end);
    if (filters.followUp === "upcoming") query = query.gte("next_follow_up_at", today.end);
    query = query.order("next_follow_up_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);
  throwIfDbError(error);
  const now = Date.now();
  const rows = (data ?? []).map((lead) => ({
    ...lead,
    followUpOverdue:
      lead.next_follow_up_at !== null && Date.parse(lead.next_follow_up_at) < now && !["converted", "lost"].includes(lead.status),
  }));
  return { rows, total: count ?? 0, filters };
}

export async function getLead(rawId: unknown) {
  const ctx = await requirePermission("lead:read");
  const id = parseInput(uuidField, rawId);
  const { data, error } = await ctx.db
    .from("leads")
    .select("*, assignee:clinic_members(id, display_name, role), patient:patients(id, full_name)")
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(error);
  if (!data) throw new AppError("not_found");

  const [history, tasks, appointments] = await Promise.all([
    ctx.db
      .from("activity_events")
      .select("id, action, metadata, actor_user_id, created_at")
      .eq("entity_type", "lead")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    ctx.db.from("tasks").select("id, title, status, due_at, completed_at").eq("lead_id", id).order("created_at", { ascending: false }),
    ctx.db.from("appointments").select("id, starts_at, status, appointment_type").eq("lead_id", id).order("starts_at", { ascending: false }),
  ]);
  throwIfDbError(history.error);
  throwIfDbError(tasks.error);
  throwIfDbError(appointments.error);
  return { lead: data, history: history.data ?? [], tasks: tasks.data ?? [], appointments: appointments.data ?? [], role: ctx.role };
}

function toRow(input: ReturnType<typeof leadInputSchema.parse>) {
  return {
    full_name: input.fullName,
    phone_e164: input.phone,
    email: input.email,
    source: input.source,
    status: input.status,
    assigned_to: input.assignedTo,
    next_follow_up_at: input.nextFollowUpAt,
    notes: input.notes,
    lost_reason: input.status === "lost" ? input.lostReason : null,
  };
}

export async function createLead(rawInput: unknown): Promise<{ id: string; source: string }> {
  const ctx = await requirePermission("lead:create");
  const input = parseInput(leadInputSchema, rawInput);
  // clinic_id is never sent: the database defaults it to the caller's clinic.
  const { data, error } = await ctx.db.from("leads").insert(toRow(input)).select("id, source").single();
  throwIfDbError(error);
  return data!;
}

export async function updateLead(rawId: unknown, rawInput: unknown): Promise<void> {
  const ctx = await requirePermission("lead:update");
  const id = parseInput(uuidField, rawId);
  const input = parseInput(leadInputSchema, rawInput);
  const { data, error } = await ctx.db.from("leads").update(toRow(input)).eq("id", id).select("id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}

export async function deleteLead(rawId: unknown): Promise<void> {
  const ctx = await requirePermission("lead:delete");
  const id = parseInput(uuidField, rawId);
  const { data, error } = await ctx.db.from("leads").delete().eq("id", id).select("id");
  if (error?.code === "23503") {
    throw new AppError("conflict", { cause: error });
  }
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}

/**
 * Creates a patient record from a lead's contact details and links them.
 * Requires both patient:create and lead:update.
 */
export async function convertLeadToPatient(rawId: unknown): Promise<{ patientId: string }> {
  const ctx = await requirePermission("patient:create");
  await requirePermission("lead:update");
  const id = parseInput(uuidField, rawId);
  const { data: lead, error } = await ctx.db
    .from("leads")
    .select("id, full_name, phone_e164, email, patient_id")
    .eq("id", id)
    .maybeSingle();
  throwIfDbError(error);
  if (!lead) throw new AppError("not_found");
  if (lead.patient_id) return { patientId: lead.patient_id };

  const { data: patient, error: insertError } = await ctx.db
    .from("patients")
    .insert({ full_name: lead.full_name, phone_e164: lead.phone_e164, email: lead.email })
    .select("id")
    .single();
  throwIfDbError(insertError);
  const { error: linkError } = await ctx.db.from("leads").update({ patient_id: patient!.id, status: "converted" }).eq("id", id);
  throwIfDbError(linkError);
  return { patientId: patient!.id };
}
