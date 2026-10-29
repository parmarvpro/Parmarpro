import "server-only";

import { z } from "zod";

import { razorpayEnv } from "@/lib/env";
import type { BillingProvider, ProviderOrder, ProviderPayment } from "@/server/billing/provider";
import { verifyCheckoutSignature } from "@/server/billing/signatures";

const API = "https://api.razorpay.com/v1";

const orderSchema = z.object({
  id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  amount: z.number().int(),
  currency: z.string(),
  receipt: z.string().nullable().optional(),
});

const paymentSchema = z.object({
  id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  order_id: z.string().nullable().optional(),
  status: z.enum(["created", "authorized", "captured", "refunded", "failed"]),
  amount: z.number().int(),
  currency: z.string(),
  method: z.string().nullable().optional(),
  error_code: z.string().nullable().optional(),
});

const paymentsSchema = z.object({ items: z.array(paymentSchema) });

function toProviderPayment(payment: z.infer<typeof paymentSchema>): ProviderPayment {
  return {
    id: payment.id,
    orderId: payment.order_id ?? null,
    status: payment.status,
    amountPaise: payment.amount,
    currency: payment.currency,
    method: payment.method ?? null,
    errorCode: payment.error_code ?? null,
  };
}

export class RazorpayApiError extends Error {
  constructor(readonly status: number) {
    super(`razorpay_api_${status}`);
    this.name = "RazorpayApiError";
  }
}

/** Minimal REST client (no SDK dependency). Credentials never leave the server. */
export function createRazorpayProvider(): BillingProvider {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = razorpayEnv();
  const authorization = `Basic ${Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64")}`;

  async function call(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization, "content-type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) throw new RazorpayApiError(response.status);
    return response.json();
  }

  return {
    name: "razorpay",
    publicKeyId: () => RAZORPAY_KEY_ID,
    async createOrder({ receipt, amountPaise, currency, notes }): Promise<ProviderOrder> {
      const order = orderSchema.parse(
        await call("/orders", { method: "POST", body: JSON.stringify({ amount: amountPaise, currency, receipt, notes }) }),
      );
      return { id: order.id, amountPaise: order.amount, currency: order.currency, receipt: order.receipt ?? null };
    },
    async fetchPayment(paymentId: string): Promise<ProviderPayment> {
      if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new RazorpayApiError(400);
      return toProviderPayment(paymentSchema.parse(await call(`/payments/${paymentId}`)));
    },
    async fetchOrderPayments(orderId: string): Promise<ProviderPayment[]> {
      if (!/^order_[A-Za-z0-9]+$/.test(orderId)) throw new RazorpayApiError(400);
      const body = paymentsSchema.parse(await call(`/orders/${orderId}/payments`));
      return body.items.map(toProviderPayment);
    },
    verifyCheckoutSignature({ orderId, paymentId, signature }) {
      return verifyCheckoutSignature({ orderId, paymentId, signature, keySecret: RAZORPAY_KEY_SECRET });
    },
  };
}
