import { expect, test } from "./fixtures";

/** A well-formed key that no clinic has. Without a database the lookup fails and the page is not found too. */
const UNKNOWN_KEY = "0".repeat(64);

test("an enquiry page for a key that matches no clinic is not found", async ({ request }) => {
  const response = await request.get(`/enquire/${UNKNOWN_KEY}`);
  expect(response.status()).toBe(404);
});

test("a malformed enquiry key is not found", async ({ request }) => {
  const response = await request.get("/enquire/not-a-key");
  expect(response.status()).toBe(404);
});

test("the automations settings page sends signed-out requests to sign-in, and back here afterwards", async ({ request }) => {
  const response = await request.get("/dashboard/settings/automations", { maxRedirects: 0 });
  expect([302, 307]).toContain(response.status());
  const location = new URL(response.headers().location ?? "", "http://127.0.0.1");
  expect(location.pathname).toBe("/sign-in");
  expect(location.searchParams.get("redirect_url")).toMatch(/\/dashboard\/settings\/automations$/);
});
