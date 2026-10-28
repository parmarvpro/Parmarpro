import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/** Constant-time comparison of two hex digests; false on any malformed input. */
export function safeEqualHex(expectedHex: string, receivedHex: string | null | undefined): boolean {
  if (!receivedHex || !/^[0-9a-f]+$/i.test(receivedHex) || receivedHex.length !== expectedHex.length) return false;
  const a = Buffer.from(expectedHex, "hex");
  const b = Buffer.from(receivedHex.toLowerCase(), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Razorpay Checkout success signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(params: { orderId: string; paymentId: string; signature: string | null | undefined; keySecret: string }): boolean {
  const expected = hmacSha256Hex(params.keySecret, `${params.orderId}|${params.paymentId}`);
  return safeEqualHex(expected, params.signature);
}

/** Razorpay webhook signature: HMAC_SHA256(raw request body, webhook secret). */
export function verifyWebhookSignature(params: { rawBody: string; signature: string | null | undefined; webhookSecret: string }): boolean {
  const expected = hmacSha256Hex(params.webhookSecret, params.rawBody);
  return safeEqualHex(expected, params.signature);
}

export function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
