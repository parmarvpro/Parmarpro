import type { Page } from "@playwright/test";

/**
 * Collects errors that belong to the app: uncaught exceptions, console errors from app code, and any failed
 * or 4xx/5xx request to the app's own origin. Third-party noise from the placeholder Clerk instance is ignored.
 */
export function appErrors(page: Page, baseURL: string | undefined): string[] {
  const errors: string[] = [];
  const origin = new URL(baseURL ?? "http://127.0.0.1:3100").origin;
  // Clerk's script cannot load from the placeholder instance (it fails to resolve offline and answers 400 in CI);
  // that is not an app error. Chromium's "Failed to load resource" console lines do not name the URL, so failed
  // requests are judged by origin below instead.
  const ignorable = /clerk|Content Security Policy|net::ERR|Failed to load resource/i;
  page.on("pageerror", (error) => {
    if (!ignorable.test(String(error))) errors.push(String(error));
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !ignorable.test(message.text())) errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.url().startsWith(origin) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    // Cancelled requests are normal (Next aborts in-flight link prefetches when the page closes); anything else is not.
    if (request.url().startsWith(origin) && request.failure()?.errorText !== "net::ERR_ABORTED") {
      errors.push(`request failed: ${request.url()} (${request.failure()?.errorText})`);
    }
  });
  return errors;
}
