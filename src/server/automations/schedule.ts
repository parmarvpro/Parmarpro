import "server-only";

import { after } from "next/server";

import { reportError } from "@/lib/observability/report";

/**
 * Runs `task` after the response has been sent. Outside a request scope (for
 * example in a script or a test) `after` throws, and the task then runs now
 * without being awaited. A failure is reported and never escapes, so the
 * caller's response or result is never affected.
 */
export function scheduleAfter(task: () => Promise<void>): void {
  const guarded = async () => {
    try {
      await task();
    } catch (error) {
      reportError(error, { area: "automations.schedule" });
    }
  };
  try {
    after(guarded);
  } catch {
    void guarded();
  }
}
