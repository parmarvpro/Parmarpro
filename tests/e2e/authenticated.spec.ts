import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

/**
 * Authenticated journey (G6 staging flow). Requires a real Clerk development
 * instance and synthetic test users, provided through environment variables:
 *   CLERK_PUBLISHABLE_KEY / CLERK_SECRET_KEY (Clerk testing tokens)
 *   E2E_OWNER_EMAIL, E2E_STAFF_EMAIL, E2E_VIEWER_EMAIL (users with +clerk_test emails)
 * When they are absent this suite does not run, and the security test report
 * records it as NOT VERIFIED rather than passed.
 */
const configured = Boolean(process.env.CLERK_SECRET_KEY && process.env.E2E_OWNER_EMAIL && process.env.E2E_VIEWER_EMAIL);

test.describe("authenticated clinic journey", () => {
  test.skip(!configured, "Clerk test credentials not provided");

  test.beforeAll(async () => {
    await clerkSetup();
  });

  test("owner creates a lead, books an appointment and adds a task", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: process.env.E2E_OWNER_EMAIL! });
    await page.goto("/dashboard/leads");
    await page.getByRole("button", { name: "Add lead" }).first().click();
    const name = `Synthetic E2E Lead ${Date.now()}`;
    await page.getByLabel("Full name").fill(name);
    await page.getByLabel("Phone").fill("9800000099");
    await page.getByRole("button", { name: "Add lead" }).last().click();
    await expect(page.getByRole("link", { name })).toBeVisible();
    await page.getByRole("link", { name }).click();
    await page.getByRole("button", { name: "Book appointment" }).click();
    await page.getByLabel("Date and time").fill("2030-01-15T10:30");
    await page.getByRole("button", { name: "Book" }).click();
    await expect(page.getByText("Appointment booked")).toBeVisible();
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByLabel("Task").fill("Synthetic follow-up call");
    await page.getByRole("button", { name: "Add task" }).last().click();
    await expect(page.getByText("Synthetic follow-up call")).toBeVisible();
  });

  test("read-only member sees records but no write controls", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: process.env.E2E_VIEWER_EMAIL! });
    await page.goto("/dashboard/leads");
    await expect(page.getByRole("heading", { name: "Leads & inquiries" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add lead" })).toHaveCount(0);
  });
});
