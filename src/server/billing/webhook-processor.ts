import { z } from "zod";

import { reconcilePayment, type ReconcileDeps, type ReconcileOutcome } from "@/server/billing/reconcile";
import { sha256Hex, verifyWebhookSignature } from "@/server/billing/signatures";

/** Events that may change billing state. Everything else is acknowledged and ignored. */
export const HANDLED_EVENTS = ["payment.captured", "payment.failed", "order.paid"] as const;

const envelopeSchema = z.object({
  event: z.string().max(100),
  payload: z.object({
    payment: z.object({ entity: z.object({ id: z.string().regex(/^pay_[A-Za-z0-9]+$/) }).passthrough() }).optional(),
    order: z.object({ entity: z.object({ id: z.string().regex(/^order_[A-Za-z0-9]+$/) }).passthrough() }).optional(),
  }).passthrough(),
}).passthrough();

export type WebhookStore = {
  /** Records receipt. Returns "new", "duplicate" (already processed/ignored) or "retry" (seen but not finished). */
  begin: (params: { eventId: string; eventType: string; payloadSha256: string }) => Promise<"new" | "duplicate" | "retry">;
  finish: (params: { eventId: string; status: "processed" | "ignored" | "failed"; error?: string }) => Promise<void>;
};

export type WebhookResult = { status: number; outcome: string };

export async function processRazorpayWebhook(
  request: { rawBody: string; signature: string | null; eventId: string | null },
  deps: { webhookSecret: string; store: WebhookStore; reconcile: ReconcileDeps; onSecuritySignal?: (reason: string) => void },
): Promise<WebhookResult> {
  if (!verifyWebhookSignature({ rawBody: request.rawBody, signature: request.signature, webhookSecret: deps.webhookSecret })) {
    deps.onSecuritySignal?.("razorpay_webhook_invalid_signature");
    return { status: 400, outcome: "invalid_signature" };
  }
  if (!request.eventId || !/^[A-Za-z0-9_-]{1,100}$/.test(request.eventId)) {
    return { status: 400, outcome: "missing_event_id" };
  }

  let envelope: z.infer<typeof envelopeSchema>;
  try {
    envelope = envelopeSchema.parse(JSON.parse(request.rawBody));
  } catch {
    return { status: 400, outcome: "malformed_payload" };
  }

  const state = await deps.store.begin({ eventId: request.eventId, eventType: envelope.event, payloadSha256: sha256Hex(request.rawBody) });
  if (state === "duplicate") return { status: 200, outcome: "duplicate" };

  if (!(HANDLED_EVENTS as readonly string[]).includes(envelope.event)) {
    await deps.store.finish({ eventId: request.eventId, status: "ignored", error: "unhandled_event_type" });
    return { status: 200, outcome: "ignored" };
  }

  const paymentId = envelope.payload.payment?.entity.id;
  if (!paymentId) {
    await deps.store.finish({ eventId: request.eventId, status: "ignored", error: "no_payment_entity" });
    return { status: 200, outcome: "ignored" };
  }

  let outcome: ReconcileOutcome;
  try {
    outcome = await reconcilePayment(paymentId, {}, deps.reconcile);
  } catch {
    // Provider or database unavailable: let Razorpay retry later.
    await deps.store.finish({ eventId: request.eventId, status: "failed", error: "reconcile_error" });
    return { status: 500, outcome: "retry_later" };
  }

  switch (outcome.kind) {
    case "paid":
    case "pending":
    case "failed":
      await deps.store.finish({ eventId: request.eventId, status: "processed" });
      return { status: 200, outcome: outcome.kind };
    case "mismatch":
      deps.onSecuritySignal?.(`razorpay_webhook_mismatch_${outcome.reason}`);
      await deps.store.finish({ eventId: request.eventId, status: "failed", error: `mismatch_${outcome.reason}` });
      return { status: 200, outcome: "mismatch" };
    case "not_found":
      await deps.store.finish({ eventId: request.eventId, status: "ignored", error: "unknown_order" });
      return { status: 200, outcome: "unknown_order" };
    case "ignored":
      await deps.store.finish({ eventId: request.eventId, status: "ignored", error: outcome.reason });
      return { status: 200, outcome: "ignored" };
  }
}
