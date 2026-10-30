import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against a production build (`next start`).
 * - BASE_URL set: run against an already-deployed environment (staging).
 * - Otherwise a local server is started with placeholder integration keys,
 *   which is enough for public pages and API security checks.
 * Authenticated journeys need real Clerk test credentials (see
 * tests/e2e/authenticated.spec.ts and docs/deployment.md).
 */
const PORT = 3100;
const baseURL = process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`;
// Protected preview deployments (Vercel Deployment Protection) let automation through with this header.
// Only the nightly staging run sets it. An empty value counts as not set.
const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    // Traces record every request header, so with the bypass header set they would carry the secret
    // into the uploaded report. Screenshots carry no headers.
    ...(bypassSecret ? { trace: "off", screenshot: "only-on-failure" } : { trace: "retain-on-failure" }),
    ...(bypassSecret
      ? {
          extraHTTPHeaders: {
            "x-vercel-protection-bypass": bypassSecret,
            "x-vercel-set-bypass-cookie": "true",
          },
        }
      : {}),
    // Sandboxed dev containers route traffic through an egress proxy; talk to the local server directly.
    launchOptions: process.env.BASE_URL ? {} : { args: ["--no-proxy-server"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `pnpm start -p ${PORT}`,
        url: `${baseURL}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk", // gitleaks:allow placeholder
          CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "sk_test_placeholder_for_e2e_only",
          CLERK_WEBHOOK_SIGNING_SECRET: process.env.CLERK_WEBHOOK_SIGNING_SECRET || "whsec_ZTJlcGxhY2Vob2xkZXJzZWNyZXQ=",
          SUPABASE_URL: process.env.SUPABASE_URL || "http://127.0.0.1:1",
          SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_e2e_placeholder",
        },
      },
});
