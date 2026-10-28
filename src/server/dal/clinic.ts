import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import { reportError } from "@/lib/observability/report";
import { clinicSettingsSchema } from "@/lib/validation/clinic";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/auth/errors";
import { throwIfDbError } from "@/server/db/errors";
import { parseInput } from "@/server/validation";

export async function getClinic() {
  const ctx = await requirePermission("clinic:read");
  const { data, error } = await ctx.db.from("clinics").select("id, name, city, timezone, created_at").eq("id", ctx.clinicId).maybeSingle();
  throwIfDbError(error);
  if (!data) throw new AppError("not_found");
  return { clinic: data, role: ctx.role };
}

export async function updateClinic(rawInput: unknown): Promise<void> {
  const ctx = await requirePermission("clinic:update");
  const input = parseInput(clinicSettingsSchema, rawInput);
  const { data, error } = await ctx.db.from("clinics").update({ name: input.name, city: input.city }).eq("id", ctx.clinicId).select("id");
  throwIfDbError(error);
  if (!data?.length) throw new AppError("not_found");
  try {
    const clerk = await clerkClient();
    await clerk.organizations.updateOrganization(ctx.orgId, { name: input.name });
  } catch (clerkError) {
    // Clinic name in ParmarPro is the source of truth; Clerk's copy is cosmetic.
    reportError(clerkError, { area: "clinic.update.clerkName" });
  }
}
