import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";

test.describe("unauthenticated access is rejected at the server", () => {
  test("app pages redirect signed-out browsers", async ({ request }) => {
    for (const path of ["/dashboard", "/dashboard/leads", "/dashboard/settings/billing", "/onboarding"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect([302, 307, 404], path).toContain(response.status());
    }
  });

  test("billing verify requires a session", async ({ request }) => {
    const response = await request.post("/api/billing/verify", {
      data: { razorpay_order_id: "order_A1", razorpay_payment_id: "pay_B1", razorpay_signature: "a".repeat(64) },
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ error: "unauthenticated" });
  });

  test("server actions cannot be called cross-origin", async ({ request, baseURL }) => {
    const response = await request.post("/", {
      headers: { "Next-Action": "0".repeat(42), Origin: "https://evil.example", "Content-Type": "text/plain;charset=UTF-8" },
      data: "[]",
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(baseURL).toBeTruthy();
  });
});

test.describe("webhooks authenticate by signature", () => {
  test("Razorpay webhook with a forged signature is rejected", async ({ request }) => {
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_forged1" } } } });
    const forged = createHmac("sha256", "attacker-guess").update(body).digest("hex");
    const response = await request.post("/api/webhooks/razorpay", {
      headers: { "content-type": "application/json", "x-razorpay-signature": forged, "x-razorpay-event-id": "evt_forged1" },
      data: body,
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ outcome: "invalid_signature" });
  });

  test("Razorpay webhook without a signature is rejected", async ({ request }) => {
    const response = await request.post("/api/webhooks/razorpay", { data: { event: "payment.captured" } });
    expect(response.status()).toBe(400);
  });

  test("Clerk webhook without a Svix signature is rejected", async ({ request }) => {
    const response = await request.post("/api/webhooks/clerk", { data: { type: "organization.deleted", data: { id: "org_victim" } } });
    expect(response.status()).toBe(400);
  });
});

test.describe("public contact endpoint input handling", () => {
  test("rejects invalid, oversized and wrongly typed input", async ({ request }) => {
    expect((await request.post("/api/contact", { data: { fullName: "" } })).status()).toBe(422);
    expect((await request.post("/api/contact", { data: { fullName: "x".repeat(20_000), email: "a@b.co" } })).status()).toBe(422);
    expect((await request.post("/api/contact", { data: { fullName: "Synthetic", email: "a@b.co", role: "owner" } })).status()).toBe(422);
    expect((await request.post("/api/contact", { headers: { "content-type": "text/plain" }, data: "hello" })).status()).toBe(422);
  });

  test("honeypot submissions are accepted silently", async ({ request }) => {
    const response = await request.post("/api/contact", { data: { fullName: "Bot", email: "bot@example.com", website: "http://spam.example" } });
    expect(response.status()).toBe(200);
  });
});
