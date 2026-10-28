import "server-only";

import { isConfigured } from "@/lib/env";
import { requirePermission } from "@/server/auth/context";
import { throwIfDbError } from "@/server/db/errors";

export async function getBilling() {
  const ctx = await requirePermission("billing:read");
  const [entitlement, payments] = await Promise.all([
    ctx.db.from("clinic_entitlements").select("plan_code, trial_ends_at, paid_through").eq("clinic_id", ctx.clinicId).maybeSingle(),
    ctx.db
      .from("payments")
      .select("id, provider_payment_id, status, amount_paise, currency, method, captured_at, created_at, error_code")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  throwIfDbError(entitlement.error);
  throwIfDbError(payments.error);
  return {
    role: ctx.role,
    entitled: ctx.entitled,
    onTrial: ctx.onTrial,
    accessEndsAt: ctx.accessEndsAt,
    entitlement: entitlement.data,
    payments: payments.data ?? [],
    paymentsConfigured: isConfigured("razorpay"),
  };
}
