import "server-only";

import { z } from "zod";

import { daysAgo, istDayBounds, istMonthStart } from "@/lib/time";
import { dateRangeSchema } from "@/lib/validation/entities";
import { requirePermission } from "@/server/auth/context";
import { throwIfDbError } from "@/server/db/errors";

const summarySchema = z.object({
  leads_created: z.number(),
  leads_by_status: z.record(z.string(), z.number()),
  leads_converted: z.number(),
  appointments_in_range: z.number(),
  appointments_by_status: z.record(z.string(), z.number()),
  tasks_completed: z.number(),
  tasks_overdue: z.number(),
  follow_ups_due: z.number(),
  patients_total: z.number(),
});
export type DashboardSummary = z.infer<typeof summarySchema>;

export async function getDashboard(rawRange: unknown) {
  const ctx = await requirePermission("dashboard:read");
  const { range } = dateRangeSchema.parse(rawRange ?? {});
  const to = new Date().toISOString();
  const from = range === "month" ? istMonthStart() : daysAgo(range === "7d" ? 7 : range === "90d" ? 90 : 30);
  const today = istDayBounds();

  const [summary, recentLeads, upcoming, overdue, activity] = await Promise.all([
    ctx.db.rpc("dashboard_summary", { p_from: from, p_to: to }),
    ctx.db.from("leads").select("id, full_name, source, status, created_at").order("created_at", { ascending: false }).limit(5),
    ctx.db
      .from("appointments")
      .select("id, starts_at, status, appointment_type, patient:patients(full_name), lead:leads(full_name)")
      .gte("starts_at", today.start)
      .in("status", ["scheduled", "confirmed"])
      .order("starts_at")
      .limit(6),
    ctx.db
      .from("tasks")
      .select("id, title, due_at, assignee:clinic_members(display_name, role)")
      .eq("status", "open")
      .lt("due_at", to)
      .order("due_at")
      .limit(6),
    ctx.db.from("activity_events").select("id, entity_type, entity_id, action, metadata, created_at").order("created_at", { ascending: false }).limit(10),
  ]);
  throwIfDbError(summary.error);
  throwIfDbError(recentLeads.error);
  throwIfDbError(upcoming.error);
  throwIfDbError(overdue.error);
  throwIfDbError(activity.error);

  return {
    range,
    summary: summarySchema.parse(summary.data),
    recentLeads: recentLeads.data ?? [],
    upcoming: upcoming.data ?? [],
    overdue: overdue.data ?? [],
    activity: activity.data ?? [],
    clinicName: ctx.clinicName,
    role: ctx.role,
  };
}
