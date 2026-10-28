import { test as base } from "@playwright/test";

/**
 * When E2E runs locally with the placeholder Clerk development key (no real
 * Clerk instance reachable), Clerk's middleware would redirect every browser
 * navigation to the instance's Frontend API for the "dev browser" handshake.
 * Pre-setting a placeholder dev-browser cookie lets signed-out pages render.
 * This is test-side only: the app has no bypass, protected pages still
 * redirect to sign-in, and with real keys (CI/staging) this is not used.
 */
const usingPlaceholderClerk = !process.env.BASE_URL && !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    if (usingPlaceholderClerk && baseURL) {
      await context.addCookies([{ name: "__clerk_db_jwt", value: "local-e2e-placeholder", url: baseURL }]);
    }
    await use(context);
  },
});

export { expect } from "@playwright/test";
