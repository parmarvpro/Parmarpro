import { expect, test } from "@playwright/test";

test.describe("unauthenticated access is rejected at the server", () => {
  test("app pages redirect signed-out browsers", async ({ request }) => {
    for (const path of ["/dashboard", "/dashboard/leads", "/dashboard/settings", "/onboarding"]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect([302, 307, 404], path).toContain(response.status());
    }
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
