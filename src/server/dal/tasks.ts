import "server-only";

import { istDayBounds } from "@/lib/time";
import { z } from "zod";

import { TASK_STATUSES, taskFiltersSchema, taskInputSchema, uuidField, type TaskFilters } from "@/lib/validation/entities";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/auth/errors";
import { throwIfDbError } from "@/server/db/errors";
import { pageRange } from "@/server/dal/shared";
import { parseInput } from "@/server/validation";

const LIST_COLUMNS =
  "id, title, description, due_at, status, completed_at, assigned_to, lead:leads(id, full_name), patient:patients(id, full_name), appointment_id, assignee:clinic_members(id, display_name, role)";

export async function listTasks(rawFilters: unknown) {
  const ctx = await requirePermission("task:read");
  const filters: TaskFilters = taskFiltersSchema.parse(rawFilters ?? {});
  const { from, to } = pageRange(filters.page);
  const today = istDayBounds();
  let query = ctx.db.from("tasks").select(LIST_COLUMNS, { count: "exact" });
  switch (filters.view) {
    case "open":
      query = query.eq("status", "open").order("due_at", { ascending: true, nullsFirst: false });
      break;
    case "overdue":
      query = query.eq("status", "open").lt("due_at", today.start).order("due_at");
      break;
    case "today":
      query = query.eq("status", "open").gte("due_at", today.start).lt("due_at", today.end).order("due_at");
      break;
    case "done":
      query = query.eq("status", "done").order("completed_at", { ascending: false });
      break;
    case "all":
      query = query.order("created_at", { ascending: false });
      break;
  }
  if (filters.assignee === "me") query = query.eq("assigned_to", ctx.memberId);
  else if (filters.assignee) query = query.eq("assigned_to", filters.assignee);
  const { data, error, count } = await query.range(from, to);
  throwIfDbError(error);
  return { rows: data ?? [], total: count ?? 0, filters, role: ctx.role };
}

function toRow(input: ReturnType<typeof taskInputSchema.parse>) {
  return {
    title: input.title,
    description: input.description,
    due_at: input.dueAt,
    assigned_to: input.assignedTo,
    lead_id: input.leadId,
    patient_id: input.patientId,
    appointment_id: input.appointmentId,
  };
}

export async function createTask(rawInput: unknown): Promise<{ id: string }> {
  const ctx = await requirePermission("task:create");
  const input = parseInput(taskInputSchema, rawInput);
  const { data, error } = await ctx.db.from("tasks").insert(toRow(input)).select("id").single();
  throwIfDbError(error);
  return data!;
}

export async function updateTask(rawId: unknown, rawInput: unknown): Promise<void> {
  const ctx = await requirePermission("task:update");
  const id = parseInput(uuidField, rawId);
  const input = parseInput(taskInputSchema, rawInput);
  const { data, error } = await ctx.db.from("tasks").update(toRow(input)).eq("id", id).select("id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}

export async function setTaskStatus(rawId: unknown, rawStatus: unknown): Promise<void> {
  const ctx = await requirePermission("task:update");
  const id = parseInput(uuidField, rawId);
  const status = parseInput(z.enum(TASK_STATUSES), rawStatus);
  const { data, error } = await ctx.db.from("tasks").update({ status }).eq("id", id).select("id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}

export async function deleteTask(rawId: unknown): Promise<void> {
  const ctx = await requirePermission("task:delete");
  const id = parseInput(uuidField, rawId);
  const { data, error } = await ctx.db.from("tasks").delete().eq("id", id).select("id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
}
