import { expect, test } from "./fixtures";

test("GET /api/health answers ok, uncached, with no secrets in the body", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(await response.json()).toEqual({ status: "ok", env: expect.stringMatching(/^(development|staging|production)$/) });
});

test("HEAD /api/health answers 200 with no body", async ({ request }) => {
  const response = await request.head("/api/health");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.body()).toHaveLength(0);
});
