import type { BillingProvider } from "@/server/billing/provider";

export type BillingOrderRecord = {
  id: string;
  clinic_id: string;
  provider_order_id: string;
  amount_paise: number;
  currency: string;
  plan_code: string;
  status: string;
};

export type ReconcileDeps = {
  provider: Pick<BillingProvider, "fetchPayment">;
  findOrder: (providerOrderId: string) => Promise<BillingOrderRecord | null>;
  applyPayment: (params: {
    billingOrderId: string;
    providerOrderId: string;
    providerPaymentId: string;
    amountPaise: number;
    currency: string;
    method: string | null;
  }) => Promise<{ applied: boolean; paidThrough: string | null }>;
  recordAttempt: (params: {
    billingOrderId: string;
    providerOrderId: string;
    providerPaymentId: string;
    status: "authorized" | "failed";
    amountPaise: number;
    currency: string;
    method: string | null;
    errorCode: string | null;
  }) => Promise<void>;
};

export type ReconcileOutcome =
  | { kind: "paid"; applied: boolean; paidThrough: string | null; planCode: string }
  | { kind: "pending" }
  | { kind: "failed" }
  | { kind: "not_found" }
  | { kind: "mismatch"; reason: "order" | "amount" | "currency" }
  | { kind: "ignored"; reason: string };

/**
 * The single place that decides whether a payment grants paid access.
 * Facts come from the provider API (server-to-server), never from the browser.
 * Access is granted only when the payment is captured, belongs to an order
 * ParmarPro created (and, when given, to the expected clinic), and the amount
 * and currency match that order exactly.
 */
export async function reconcilePayment(
  paymentId: string,
  expected: { providerOrderId?: string; clinicId?: string },
  deps: ReconcileDeps,
): Promise<ReconcileOutcome> {
  const payment = await deps.provider.fetchPayment(paymentId);
  if (!payment.orderId) return { kind: "ignored", reason: "payment_without_order" };
  if (expected.providerOrderId && payment.orderId !== expected.providerOrderId) return { kind: "mismatch", reason: "order" };

  const order = await deps.findOrder(payment.orderId);
  if (!order) return { kind: "not_found" };
  if (expected.clinicId && order.clinic_id !== expected.clinicId) return { kind: "not_found" };
  if (payment.currency !== order.currency) return { kind: "mismatch", reason: "currency" };
  if (payment.amountPaise !== order.amount_paise) return { kind: "mismatch", reason: "amount" };

  const base = {
    billingOrderId: order.id,
    providerOrderId: order.provider_order_id,
    providerPaymentId: payment.id,
    amountPaise: payment.amountPaise,
    currency: payment.currency,
    method: payment.method,
  };

  switch (payment.status) {
    case "captured": {
      const result = await deps.applyPayment(base);
      return { kind: "paid", applied: result.applied, paidThrough: result.paidThrough, planCode: order.plan_code };
    }
    case "authorized":
      await deps.recordAttempt({ ...base, status: "authorized", errorCode: null });
      return { kind: "pending" };
    case "failed":
      await deps.recordAttempt({ ...base, status: "failed", errorCode: payment.errorCode });
      return { kind: "failed" };
    case "created":
      return { kind: "pending" };
    case "refunded":
      return { kind: "ignored", reason: "refunded" };
  }
}
