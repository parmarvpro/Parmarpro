import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { safeEqualHex, verifyCheckoutSignature, verifyWebhookSignature } from "@/server/billing/signatures";

const SECRET = "test_key_secret_not_real";
const sign = (payload: string, secret = SECRET) => createHmac("sha256", secret).update(payload).digest("hex");

describe("Razorpay checkout signature (order_id|payment_id)", () => {
  it("accepts the exact signature Razorpay computes", () => {
    const signature = sign("order_ABC123|pay_XYZ789");
    expect(verifyCheckoutSignature({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature, keySecret: SECRET })).toBe(true);
  });

  it.each([
    ["swapped ids", sign("pay_XYZ789|order_ABC123")],
    ["other order", sign("order_OTHER|pay_XYZ789")],
    ["wrong secret", sign("order_ABC123|pay_XYZ789", "another_secret")],
    ["truncated", sign("order_ABC123|pay_XYZ789").slice(0, 40)],
    ["non-hex", "z".repeat(64)],
    ["empty", ""],
  ])("rejects %s", (_name, signature) => {
    expect(verifyCheckoutSignature({ orderId: "order_ABC123", paymentId: "pay_XYZ789", signature, keySecret: SECRET })).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyCheckoutSignature({ orderId: "order_A", paymentId: "pay_B", signature: null, keySecret: SECRET })).toBe(false);
  });
});

describe("Razorpay webhook signature (raw body)", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: {} });

  it("BL-01 accepts only the HMAC of the exact raw body", () => {
    expect(verifyWebhookSignature({ rawBody: body, signature: sign(body), webhookSecret: SECRET })).toBe(true);
    expect(verifyWebhookSignature({ rawBody: `${body} `, signature: sign(body), webhookSecret: SECRET })).toBe(false);
    expect(verifyWebhookSignature({ rawBody: body, signature: undefined, webhookSecret: SECRET })).toBe(false);
  });

  it("is case-insensitive on hex but strict on length", () => {
    expect(safeEqualHex("abcdef", "ABCDEF")).toBe(true);
    expect(safeEqualHex("abcdef", "abcde")).toBe(false);
  });
});
