import { z } from "zod";

import { reportError } from "@/lib/observability/report";
import { AppError } from "@/server/auth/errors";
import { verifyCheckout } from "@/server/billing/checkout";
import { errorResponse, jsonResponse, readJsonBody } from "@/server/http";
import { parseInput } from "@/server/validation";

const bodySchema = z
  .object({
    razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]{1,64}$/),
    razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{1,64}$/),
    razorpay_signature: z.string().regex(/^[0-9a-f]{64}$/i),
  })
  .strict();

/** Browser checkout callback. Authenticated, owner-only, never trusted on its own. */
export async function POST(request: Request) {
  try {
    const body = parseInput(bodySchema, await readJsonBody(request, 4 * 1024));
    const outcome = await verifyCheckout({
      orderId: body.razorpay_order_id,
      paymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
    switch (outcome.kind) {
      case "paid":
        return jsonResponse({ status: "paid", paidThrough: outcome.paidThrough });
      case "pending":
        return jsonResponse({ status: "pending" }, 202);
      case "failed":
        return jsonResponse({ status: "failed" }, 402);
      case "mismatch":
        reportError(new Error("checkout_mismatch"), { area: "billing.verify", code: outcome.reason });
        throw new AppError("invalid_input");
      case "not_found":
      case "ignored":
        throw new AppError("not_found");
    }
  } catch (error) {
    return errorResponse(error, "api.billing.verify");
  }
}
