"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics/client";

/** Sends `registration_completed` once per browser when a new user first reaches onboarding. */
export function RegistrationTracker() {
  useEffect(() => {
    try {
      if (window.localStorage.getItem("pp_registration_tracked")) return;
      // Give PostHog a moment to initialise in the provider effect.
      const timer = window.setTimeout(() => {
        track("registration_completed", {});
        window.localStorage.setItem("pp_registration_tracked", "1");
      }, 500);
      return () => window.clearTimeout(timer);
    } catch {
      // Storage unavailable (private mode): skip rather than double count.
    }
  }, []);
  return null;
}
