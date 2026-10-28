"use client";

import posthog from "posthog-js";

import { validateEvent, type AnalyticsEvent, type AnalyticsProps } from "@/lib/analytics/events";

/**
 * The only way the app sends product events. Silently does nothing when
 * analytics is not configured, not yet initialised, or the user opted out.
 * Events failing the schema are dropped, never "fixed up".
 */
export function track<E extends AnalyticsEvent>(event: E, props: AnalyticsProps<E>): void {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  if (posthog.has_opted_out_capturing()) return;
  const safe = validateEvent(event, props);
  if (!safe) {
    if (process.env.NODE_ENV !== "production") console.warn(`[analytics] dropped invalid event ${event}`);
    return;
  }
  posthog.capture(event, safe as Record<string, unknown>);
}
