"use client";

import { usePathname } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useRef } from "react";

import { track } from "@/lib/analytics/client";
import { routeTemplate } from "@/lib/analytics/events";

type Props = {
  apiKey: string | undefined;
  /** PostHog UI host (for links only); events go through the same-origin /ingest proxy. */
  apiHost: string;
  /** SHA-256 of the Clerk user id: pseudonymous, never an email or name. */
  analyticsUserId: string;
  /** Internal clinic UUID (opaque), or null before onboarding. */
  clinicId: string | null;
  children: React.ReactNode;
};

/**
 * PostHog for authenticated product usage only (not loaded on marketing
 * pages). Privacy settings: no autocapture, no session recording, no automatic
 * pageviews (route templates are sent instead), all text and attributes
 * masked, Do-Not-Track respected, and an in-app opt-out.
 */
export function AnalyticsProvider({ apiKey, apiHost, analyticsUserId, clinicId, children }: Props) {
  const pathname = usePathname();
  const initialised = useRef(false);

  useEffect(() => {
    if (!apiKey || initialised.current) return;
    initialised.current = true;
    posthog.init(apiKey, {
      api_host: "/ingest",
      ui_host: apiHost.replace(".i.posthog.com", ".posthog.com"),
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_performance: false,
      disable_session_recording: true,
      disable_surveys: true,
      enable_recording_console_log: false,
      mask_all_text: true,
      mask_all_element_attributes: true,
      respect_dnt: true,
      person_profiles: "identified_only",
      persistence: "localStorage",
      property_denylist: ["$current_url", "$pathname", "$referrer", "$referring_domain", "$initial_referrer", "$initial_current_url", "$initial_pathname"],
    });
    posthog.identify(analyticsUserId);
    if (clinicId) posthog.group("clinic", clinicId);
  }, [apiKey, apiHost, analyticsUserId, clinicId]);

  useEffect(() => {
    if (!apiKey) return;
    track("page_viewed", { route: routeTemplate(pathname) });
  }, [apiKey, pathname]);

  return <>{children}</>;
}

export function setAnalyticsOptOut(optOut: boolean) {
  if (!posthog.__loaded) return;
  if (optOut) posthog.opt_out_capturing();
  else posthog.opt_in_capturing();
}

export function isAnalyticsOptedOut(): boolean {
  return posthog.__loaded ? posthog.has_opted_out_capturing() : false;
}
