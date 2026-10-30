import { expect, test } from "./fixtures";

const PAGES = [
  { path: "/", heading: /Stop losing patients/i },
  { path: "/features", heading: /^Features$/ },
  { path: "/contact", heading: /Talk to us/i },
  { path: "/privacy", heading: /Privacy notice/i },
  { path: "/terms", heading: /Terms of service/i },
];

for (const page of PAGES) {
  test(`public page ${page.path} renders with security headers`, async ({ page: browser, request }) => {
    const response = await request.get(page.path);
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toMatch(/'nonce-[^']+'/);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-powered-by"]).toBeUndefined();

    await browser.goto(page.path);
    await expect(browser.getByRole("heading", { level: 1 })).toHaveText(page.heading);
  });
}

test("marketing pages carry no invented metrics or testimonials", async ({ page }) => {
  await page.goto("/");
  const text = (await page.locator("main").innerText()).toLowerCase();
  for (const phrase of ["testimonial", "% more patients", "trusted by", "clinics use parmarpro", "revenue recovered"]) {
    expect(text).not.toContain(phrase);
  }
  // The home page shows no sample records (the illustrated product stage, which carried the
  // "Illustration · sample data" label, is gone), so none may appear without that label.
  await expect(page.getByText("Sample inquiry")).toHaveCount(0);
  await expect(page.getByText("Illustration · sample data")).toHaveCount(0);
});

test("contact form validates input in the browser", async ({ page }) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Required.")).toBeVisible();
  await expect(page.getByText(/Add a phone number or an email/)).toBeVisible();
});

test("legal pages are honest about review status", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByText(/Draft pending legal review/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI help with enquiries" })).toBeVisible();
});
