"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics/client";

export function BillingViewed() {
  useEffect(() => {
    track("billing_page_viewed", {});
  }, []);
  return null;
}
