"use client";

import { BarChart3Icon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { isAnalyticsOptedOut, setAnalyticsOptOut } from "@/components/providers/analytics-provider";
import { Button } from "@/components/ui/button";

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function AnalyticsToggle() {
  const optedOut = useSyncExternalStore(subscribe, isAnalyticsOptedOut, () => false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start text-xs text-muted-foreground"
      onClick={() => {
        setAnalyticsOptOut(!optedOut);
        listeners.forEach((listener) => listener());
      }}
    >
      <BarChart3Icon />
      Product analytics: {optedOut ? "off" : "on"}
    </Button>
  );
}
