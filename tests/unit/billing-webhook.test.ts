import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReconcileDeps } from "@/server/billing/reconcile";
import { processRazorpayWebhook, type WebhookStore } from "@/server/billing/webhook-processor";

const SECRET = "whsec_test_only_value";

function delivery(event: string, paymentId = "pay_P1", eventId = "evt_1") {
  const rawBody = JSON.stringify({ event, payload: { payment: { entity: { id: paymentId, amount: 8850000 } } }, created_at: 1 });
  return { rawBody, signature: createHmac("sha256", SECRET).update(rawBody).digest("hex"), eventId };
}

let seen: Map<string, string>;
let store: WebhookStore;
let reconcile: ReconcileDeps;
let applyPayment: ReturnType<typeof vi.fn>;
let signals: string[];

beforeEach(() => {
  seen = new Map();
  signals = [];
  store = {
    begin: vi.fn(async ({ eventId }) => {
      const status = seen.get(eventId);
      if (!status) {
        seen.set(eventId, "received");
        return "new" as const;
      }
      return status === "processed" || status === "ignored" ? ("duplicate" as const) : ("retry" as const);
    }),
    finish: vi.fn(async ({ eventId, status }) => {
      seen.set(eventId, status);
    }),
  };
  applyPayment = vi.fn(async () => ({ applied: true, paidThrough: "2026-12-01T00:00:00Z" }));
  reconcile = {
    provider: {
      fetchPayment: vi.fn(async (id: string) => ({ id, orderId: "order_A1", status: "captured" as const, amountPaise: 8_850_000, currency: "INR", method: "upi", errorCode: null })),
    },
    findOrder: vi.fn(async () => ({ id: "o1", clinic_id: "c1", provider_order_id: "order_A1", amount_paise: 8_850_000, currency: "INR", plan_code: "parmarpro_clinic_monthly", status: "created" })),
    applyPayment,
    recordAttempt: vi.fn(async () => undefined),
  };
});

const run = (request: { rawBody: string; signature: string | null; eventId: string | null }) =>
  processRazorpayWebhook(request, { webhookSecret: SECRET, store, reconcile, onSecuritySignal: (s) => signals.push(s) });

describe("Razorpay webhook processing", () => {
  it("BL-01 rejects an invalid signature before touching any state", async () => {
    const request = delivery("payment.captured");
    await expect(run({ ...request, signature: "0".repeat(64) })).resolves.toEqual({ status: 400, outcome: "invalid_signature" });
    await expect(run({ ...request, signature: null })).resolves.toMatchObject({ status: 400 });
    expect(store.begin).not.toHaveBeenCalled();
    expect(applyPayment).not.toHaveBeenCalled();
    expect(signals).toContain("razorpay_webhook_invalid_signature");
  });

  it("rejects a signed body that was tampered with", async () => {
    const request = delivery("payment.captured");
    const tampered = request.rawBody.replace("8850000", "1");
    await expect(run({ ...request, rawBody: tampered })).resolves.toMatchObject({ status: 400 });
  });

  it("BL-02 a valid captured event applies the payment", async () => {
    await expect(run(delivery("payment.captured"))).resolves.toEqual({ status: 200, outcome: "paid" });
    expect(applyPayment).toHaveBeenCalledTimes(1);
  });

  it("BL-03 a duplicate delivery of the same event is a no-op", async () => {
    const request = delivery("payment.captured");
    await run(request);
    await expect(run(request)).resolves.toEqual({ status: 200, outcome: "duplicate" });
    expect(applyPayment).toHaveBeenCalledTimes(1);
  });

  it("BL-09 unknown event types are acknowledged and ignored", async () => {
    await expect(run(delivery("refund.created"))).resolves.toEqual({ status: 200, outcome: "ignored" });
    await expect(run(delivery("subscription.charged", "pay_P2", "evt_2"))).resolves.toEqual({ status: 200, outcome: "ignored" });
    expect(reconcile.provider.fetchPayment).not.toHaveBeenCalled();
    expect(applyPayment).not.toHaveBeenCalled();
  });

  it("BL-05 a mismatched amount is flagged and never applied", async () => {
    reconcile.provider.fetchPayment = vi.fn(async (id: string) => ({ id, orderId: "order_A1", status: "captured" as const, amountPaise: 100, currency: "INR", method: null, errorCode: null }));
    await expect(run(delivery("payment.captured"))).resolves.toEqual({ status: 200, outcome: "mismatch" });
    expect(applyPayment).not.toHaveBeenCalled();
    expect(signals).toContain("razorpay_webhook_mismatch_amount");
  });

  it("uses the provider API, not the webhook body, as the source of truth", async () => {
    reconcile.provider.fetchPayment = vi.fn(async (id: string) => ({ id, orderId: "order_A1", status: "failed" as const, amountPaise: 8_850_000, currency: "INR", method: null, errorCode: "GATEWAY_ERROR" }));
    await expect(run(delivery("payment.captured"))).resolves.toEqual({ status: 200, outcome: "failed" });
    expect(applyPayment).not.toHaveBeenCalled();
  });

  it("asks Razorpay to retry when reconciliation fails transiently", async () => {
    reconcile.provider.fetchPayment = vi.fn(async () => {
      throw new Error("network");
    });
    const request = delivery("payment.captured");
    await expect(run(request)).resolves.toEqual({ status: 500, outcome: "retry_later" });
    reconcile.provider.fetchPayment = vi.fn(async (id: string) => ({ id, orderId: "order_A1", status: "captured" as const, amountPaise: 8_850_000, currency: "INR", method: null, errorCode: null }));
    await expect(run(request)).resolves.toEqual({ status: 200, outcome: "paid" });
  });

  it("requires an event id and well-formed JSON", async () => {
    const request = delivery("payment.captured");
    await expect(run({ ...request, eventId: null })).resolves.toMatchObject({ status: 400, outcome: "missing_event_id" });
    const body = "not json";
    await expect(run({ rawBody: body, signature: createHmac("sha256", SECRET).update(body).digest("hex"), eventId: "evt_9" })).resolves.toMatchObject({
      status: 400,
      outcome: "malformed_payload",
    });
  });
});
