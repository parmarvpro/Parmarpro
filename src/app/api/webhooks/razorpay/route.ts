import { razorpayWebhookEnv } from "@/lib/env";
import { reportError } from "@/lib/observability/report";
import { createRazorpayProvider } from "@/server/billing/razorpay";
import { processRazorpayWebhook } from "@/server/billing/webhook-processor";
import { errorResponse, jsonResponse, readTextBody } from "@/server/http";
import { reconcileStore, webhookStore } from "@/server/privileged/billing";

/**
 * Razorpay webhook. Authenticated only by the HMAC signature over the raw
 * body; no cookies or sessions are involved.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await readTextBody(request, 64 * 1024);
    const result = await processRazorpayWebhook(
      {
        rawBody,
        signature: request.headers.get("x-razorpay-signature"),
        eventId: request.headers.get("x-razorpay-event-id"),
      },
      {
        webhookSecret: razorpayWebhookEnv().RAZORPAY_WEBHOOK_SECRET,
        store: webhookStore("razorpay"),
        reconcile: { provider: createRazorpayProvider(), ...reconcileStore },
        onSecuritySignal: (reason) => reportError(new Error(reason), { area: "webhook.razorpay", code: reason }),
      },
    );
    return jsonResponse({ outcome: result.outcome }, result.status);
  } catch (error) {
    return errorResponse(error, "webhook.razorpay");
  }
}
