import "server-only";

import { isConfigured } from "@/lib/env";
import type { ProviderPayment } from "@/server/billing/provider";
import { createRazorpayProvider } from "@/server/billing/razorpay";
import { reconcilePayment, type ReconcileOutcome } from "@/server/billing/reconcile";
import type { JobFn } from "@/server/jobs/registry";
import { createTally, forEachItem } from "@/server/jobs/tally";
import { reconcileStore } from "@/server/privileged/billing";
import { expireBillingOrder, staleBillingOrders, type StaleBillingOrder } from "@/server/privileged/jobs";

const AREA = "jobs.reconcile-payments";
const HOUR_MS = 60 * 60 * 1000;
/** An order with no authorized payment that is still unpaid after this long is expired. */
const EXPIRE_AFTER_MS = 48 * HOUR_MS;
/**
 * An order whose payment was authorized but never captured is expired after
 * this long. ParmarPro uses automatic capture, and Razorpay refunds payments
 * that stay uncaptured, so such an order can no longer be paid. Without this
 * limit those orders would stay in the oldest-first window of every run.
 */
const ABANDON_AFTER_MS = 7 * 24 * HOUR_MS;

export type ReconcilePaymentsDeps = {
  staleOrders: (now: Date) => Promise<StaleBillingOrder[]>;
  fetchOrderPayments: (orderId: string) => Promise<ProviderPayment[]>;
  reconcile: (paymentId: string, expected: { providerOrderId: string; clinicId: string }) => Promise<ReconcileOutcome>;
  /** False when the order was no longer 'created'. */
  expireOrder: (id: string) => Promise<boolean>;
};

/**
 * Checks unpaid orders against the provider, so a payment whose webhook or
 * browser callback never arrived still grants access. A captured payment goes
 * through the same reconciliation as a webhook.
 */
export function createReconcilePaymentsJob(deps: ReconcilePaymentsDeps): JobFn {
  return async ({ now, dryRun }) => {
    const tally = createTally();
    const orders = await deps.staleOrders(now);
    await forEachItem(orders, tally, AREA, async (order) => {
      if (dryRun) {
        tally.add("would_check");
        return;
      }
      const payments = await deps.fetchOrderPayments(order.provider_order_id);
      const captured = payments.find((payment) => payment.status === "captured");
      if (captured) {
        const outcome = await deps.reconcile(captured.id, {
          providerOrderId: order.provider_order_id,
          clinicId: order.clinic_id,
        });
        tally.add(outcome.kind === "paid" ? "paid" : `reconcile_${outcome.kind}`);
        return;
      }
      const hasAuthorized = payments.some((payment) => payment.status === "authorized");
      // NaN (an unreadable created_at) is not older than the limit, so the order stays pending.
      const age = now.getTime() - Date.parse(order.created_at);
      const isOldEnough = hasAuthorized ? age > ABANDON_AFTER_MS : age > EXPIRE_AFTER_MS;
      if (!isOldEnough) {
        tally.add("pending");
        return;
      }
      tally.add((await deps.expireOrder(order.id)) ? "expired" : "already_changed");
    });
    return tally.result();
  };
}

/** Production job. Does nothing until Razorpay is configured. */
export const reconcilePaymentsJob: JobFn = async (ctx) => {
  if (!isConfigured("razorpay")) return { not_configured: 1 };
  const provider = createRazorpayProvider();
  return createReconcilePaymentsJob({
    staleOrders: staleBillingOrders,
    fetchOrderPayments: (orderId) => provider.fetchOrderPayments(orderId),
    reconcile: (paymentId, expected) => reconcilePayment(paymentId, expected, { provider, ...reconcileStore }),
    expireOrder: expireBillingOrder,
  })(ctx);
};
