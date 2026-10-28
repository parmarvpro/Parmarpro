import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

import { scrubBreadcrumb, scrubEvent } from "@/lib/observability/scrub";

/** Options shared by the client, server and edge Sentry SDKs. */
export function sentryBaseOptions() {
  const environment = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
    environment,
    // No IP addresses, cookies or user data are attached automatically.
    sendDefaultPii: false,
    tracesSampleRate: environment === "production" ? 0.1 : 0.2,
    maxBreadcrumbs: 30,
    ignoreErrors: ["ResizeObserver loop limit exceeded", "ResizeObserver loop completed with undelivered notifications", "AbortError"],
    beforeSend(event: ErrorEvent) {
      return scrubEvent(event);
    },
    beforeSendTransaction<T extends { transaction?: string; request?: { url?: string } }>(event: T) {
      return scrubEvent(event);
    },
    beforeBreadcrumb(breadcrumb: Breadcrumb) {
      return scrubBreadcrumb(breadcrumb);
    },
  };
}
