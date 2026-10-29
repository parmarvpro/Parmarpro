import { expect, test } from "./fixtures";

const MISSING_ENQUIRY_ID = "00000000-0000-0000-0000-000000000000";
const INVALID_MESSAGE = "This link is invalid or has expired.";

test("a bogus preferences link says it is invalid, with status 200", async ({ page, request }) => {
  const response = await request.get("/email/preferences?t=bogus");
  expect(response.status()).toBe(200);

  await page.goto("/email/preferences?t=bogus");
  await expect(page.getByText(INVALID_MESSAGE)).toBeVisible();
  await expect(page.getByRole("button")).toHaveCount(0);
});

test("the preferences page without a token says the link is invalid", async ({ page }) => {
  await page.goto("/email/preferences");
  await expect(page.getByText(INVALID_MESSAGE)).toBeVisible();
});

test("the preferences page is kept out of search engines", async ({ page }) => {
  await page.goto("/email/preferences?t=bogus");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("an enquiry page with a bogus token is not found", async ({ request }) => {
  const response = await request.get(`/ops/enquiry/${MISSING_ENQUIRY_ID}?t=bogus`);
  expect(response.status()).toBe(404);
});
