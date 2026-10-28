import "server-only";

import { randomUUID } from "node:crypto";

import { DEFAULT_PLAN, PLANS, priceBreakdown } from "@/lib/plans";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/auth/errors";
import type { BillingProvider } from "@/server/billing/provider";
import { createRazorpayProvider } from "@/server/billing/razorpay";
import { reconcilePayment, type ReconcileOutcome } from "@/server/billing/reconcile";
import { recentOpenOrderCount, reconcileStore, recordBillingOrder } from "@/server/privileged/billing";

export type CheckoutOrder = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: "INR";
  planName: string;
  clinicName: string;
};

/**
 * Creates a provider order for the next billing period. Only the clinic owner
 * may do this. The amount comes from the server-side plan catalogue.
 */
export async function startCheckout(provider: BillingProvider = createRazorpayProvider()): Promise<CheckoutOrder> {
  const ctx = await requirePermission("billing:pay");
  if ((await recentOpenOrderCount(ctx.clinicId)) >= 10) throw new AppError("rate_limited");

  const plan = PLANS[DEFAULT_PLAN];
  const price = priceBreakdown(plan);
  const billingOrderId = randomUUID();
  const order = await provider.createOrder({
    receipt: billingOrderId,
    amountPaise: price.totalPaise,
    currency: "INR",
    notes: { clinic_id: ctx.clinicId, billing_order_id: billingOrderId, plan: plan.code },
  });
  if (order.amountPaise !== price.totalPaise || order.currency !== "INR") throw new AppError("internal");

  await recordBillingOrder({
    id: billingOrderId,
    clinicId: ctx.clinicId,
    providerOrderId: order.id,
    planCode: plan.code,
    basePaise: price.basePaise,
    gstPaise: price.gstPaise,
    amountPaise: price.totalPaise,
    createdBy: ctx.userId,
  });

  return {
    keyId: provider.publicKeyId(),
    orderId: order.id,
    amountPaise: price.totalPaise,
    currency: "INR",
    planName: plan.name,
    clinicName: ctx.clinicName,
  };
}

/**
 * Handles the browser's Checkout success callback. The callback alone never
 * grants access: the signature is checked, then the payment is fetched from
 * the provider and reconciled against an order of the caller's own clinic.
 */
export async function verifyCheckout(
  input: { orderId: string; paymentId: string; signature: string },
  provider: BillingProvider = createRazorpayProvider(),
): Promise<ReconcileOutcome> {
  const ctx = await requirePermission("billing:pay");
  if (!provider.verifyCheckoutSignature(input)) throw new AppError("invalid_input");
  return reconcilePayment(input.paymentId, { providerOrderId: input.orderId, clinicId: ctx.clinicId }, { provider, ...reconcileStore });
}
