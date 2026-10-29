import "server-only";

import { reportError } from "@/lib/observability/report";
import type { JobResult } from "@/server/jobs/registry";

/** Counts outcomes for one job run. Every value is a number, so the result carries no personal data. */
export type Tally = {
  add(outcome: string): void;
  result(): JobResult;
};

export function createTally(): Tally {
  const counts = new Map<string, number>();
  return {
    add(outcome) {
      counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
    },
    result() {
      return Object.fromEntries(counts);
    },
  };
}

/**
 * Runs `handle` for each item. A failure is counted under "errors" and reported
 * under the job's area, and the rest still run: one bad item never stops a job.
 */
export async function forEachItem<T>(
  items: readonly T[],
  tally: Tally,
  area: string,
  handle: (item: T) => Promise<void>,
): Promise<void> {
  for (const item of items) {
    try {
      await handle(item);
    } catch (error) {
      tally.add("errors");
      reportError(error, { area });
    }
  }
}
