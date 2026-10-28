import "server-only";

import type { BillingOrderRecord, ReconcileDeps } from "@/server/billing/reconcile";
import type { WebhookStore } from "@/server/billing/webhook-processor";
import { privilegedDb } from "@/server/privileged/client";

/**
 * PRIVILEGED billing operations. Callers must have either verified a
 * provider signature (webhooks) or authenticated + authorized the user and
 * verified the checkout signature (verify route / order creation).
 */

export async function findBillingOrder(providerOrderId: string): Promise<BillingOrderRecord | null> {
  if (!/^order_[A-Za-z0-9]+$/.test(providerOrderId)) return null;
  const { data, error } = await privilegedDb()
    .from("billing_orders")
    .select("id, clinic_id, provider_order_id, amount_paise, currency, plan_code, status")
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function recordBillingOrder(row: {
  id: string;
  clinicId: string;
  providerOrderId: string;
  planCode: string;
  basePaise: number;
  gstPaise: number;
  amountPaise: number;
  createdBy: string;
}): Promise<void> {
  const { error } = await privilegedDb().from("billing_orders").insert({
    id: row.id,
    clinic_id: row.clinicId,
    provider_order_id: row.providerOrderId,
    plan_code: row.planCode,
    period_months: 1,
    base_paise: row.basePaise,
    gst_paise: row.gstPaise,
    amount_paise: row.amountPaise,
    currency: "INR",
    created_by: row.createdBy,
  });
  if (error) throw error;
}

/** Number of unpaid orders a clinic created in the last hour (abuse guard). */
export async function recentOpenOrderCount(clinicId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await privilegedDb()
    .from("billing_orders")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("status", "created")
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

export const reconcileStore: Omit<ReconcileDeps, "provider"> = {
  findOrder: findBillingOrder,
  async applyPayment(params) {
    const { data, error } = await privilegedDb().rpc("apply_verified_payment", {
      p_billing_order_id: params.billingOrderId,
      p_provider_order_id: params.providerOrderId,
      p_provider_payment_id: params.providerPaymentId,
      p_amount_paise: params.amountPaise,
      p_currency: params.currency,
      p_method: params.method && /^[a-z_]{1,20}$/.test(params.method) ? params.method : undefined,
    });
    if (error) throw error;
    const result = data as { applied: boolean; paid_through?: string | null };
    return { applied: result.applied, paidThrough: result.paid_through ?? null };
  },
  async recordAttempt(params) {
    const { error } = await privilegedDb().rpc("record_payment_attempt", {
      p_billing_order_id: params.billingOrderId,
      p_provider_order_id: params.providerOrderId,
      p_provider_payment_id: params.providerPaymentId,
      p_status: params.status,
      p_amount_paise: params.amountPaise,
      p_currency: params.currency,
      p_method: params.method && /^[a-z_]{1,20}$/.test(params.method) ? params.method : undefined,
      p_error_code: params.errorCode ?? undefined,
    });
    if (error) throw error;
  },
};

export function webhookStore(provider: "razorpay" | "clerk"): WebhookStore {
  return {
    async begin({ eventId, eventType, payloadSha256 }) {
      const db = privilegedDb();
      const { error } = await db
        .from("webhook_events")
        .insert({ provider, event_id: eventId, event_type: eventType.slice(0, 100), payload_sha256: payloadSha256 });
      if (!error) return "new";
      if (error.code !== "23505") throw error;
      const { data, error: readError } = await db
        .from("webhook_events")
        .select("status")
        .eq("provider", provider)
        .eq("event_id", eventId)
        .single();
      if (readError) throw readError;
      return data.status === "processed" || data.status === "ignored" ? "duplicate" : "retry";
    },
    async finish({ eventId, status, error }) {
      const { error: updateError } = await privilegedDb()
        .from("webhook_events")
        .update({ status, error: error?.slice(0, 500) ?? null, processed_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("event_id", eventId);
      if (updateError) throw updateError;
    },
  };
}
