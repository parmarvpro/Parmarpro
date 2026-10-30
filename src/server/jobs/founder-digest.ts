import "server-only";

import { founderAlertEnv, isConfigured } from "@/lib/env";
import { IST, istDateKey, istDayStart } from "@/lib/ist";
import { reportError } from "@/lib/observability/report";
import { opsNeedsAttention, type OpsCounts } from "@/lib/ops-counts";
import { opsNote, type OpsNote } from "@/server/ai/features/ops-note";
import {
  founderDigestEmail,
  type DigestItem,
  type FounderMetrics,
  type OperationsSummary,
} from "@/server/email/templates";
import { enquiryManageUrl } from "@/server/jobs/links";
import type { JobFn } from "@/server/jobs/registry";
import { createTally } from "@/server/jobs/tally";
import { founderEnquiries, founderMetrics, type EnquiryRow, type FounderEnquiries } from "@/server/privileged/jobs";
import { opsCounts } from "@/server/privileged/ops";
import { notifier, type SendOnceParams, type SendOutcome } from "@/server/privileged/notifications";

const DAY_MS = 24 * 60 * 60 * 1000;
const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone: IST, weekday: "short" });

export type FounderDigestDeps = {
  /** The founder's address, or null when founder alerts are not configured. */
  to: () => string | null;
  enquiries: (now: Date) => Promise<FounderEnquiries>;
  metrics: (from: Date, to: Date) => Promise<FounderMetrics>;
  /** The operations counts since the given time. */
  ops: (since: Date) => Promise<OpsCounts>;
  /** The AI note on the counts, or null when none is available. */
  opsNote: (counts: OpsCounts) => Promise<OpsNote | null>;
  manageUrl: (enquiryId: string) => string;
  sendOnce: (params: SendOnceParams) => Promise<SendOutcome>;
};

function isMondayIst(date: Date): boolean {
  return weekdayFormat.format(date) === "Mon";
}

function toDigestItems(rows: readonly EnquiryRow[], manageUrl: (enquiryId: string) => string): DigestItem[] {
  return rows.map((row) => ({
    fullName: row.full_name,
    clinicName: row.clinic_name,
    city: row.city,
    createdAt: new Date(row.created_at),
    url: manageUrl(row.id),
  }));
}

/**
 * The operations counts, or null when they cannot be read. A failure is reported with
 * its code only, and the digest goes on without the operations section.
 */
async function readOpsCounts(read: (since: Date) => Promise<OpsCounts>, since: Date): Promise<OpsCounts | null> {
  try {
    return await read(since);
  } catch (error) {
    reportError(error, { area: "jobs.founder-digest", code: "ops_counts" });
    return null;
  }
}

/**
 * Daily digest for the founder: enquiries that need attention, on Mondays the platform
 * metrics for the previous IST week, and the operations counts for the last 24 hours. It
 * is sent when there is enquiry or metrics content, or when operations need attention.
 * Sent once per IST day.
 */
export function createFounderDigestJob(deps: FounderDigestDeps): JobFn {
  return async ({ now, dryRun }) => {
    const tally = createTally();
    const to = deps.to();
    if (to === null) {
      tally.add("not_configured");
      return tally.result();
    }

    const enquiries = await deps.enquiries(now);
    let metrics: FounderMetrics | null = null;
    if (isMondayIst(now)) {
      const dayStart = istDayStart(now);
      metrics = await deps.metrics(new Date(dayStart.getTime() - 7 * DAY_MS), dayStart);
    }
    const counts = await readOpsCounts(deps.ops, new Date(now.getTime() - DAY_MS));

    const hasEnquiries =
      enquiries.fresh.length > 0 || enquiries.dueFollowUps.length > 0 || enquiries.unanswered.length > 0;
    const attention = counts !== null && opsNeedsAttention(counts);
    if (!hasEnquiries && metrics === null && !attention) {
      tally.add("skipped_empty");
      return tally.result();
    }

    // The note is asked for only now: a digest that is sent, and never on a dry run.
    let note: OpsNote | null = null;
    if (counts !== null && !dryRun) note = await deps.opsNote(counts);
    const operations: OperationsSummary | null = counts === null ? null : { counts, note };
    tally.add(note === null ? "no_ai_note" : "ai_note");

    tally.add(
      await deps.sendOnce({
        kind: "founder_digest",
        clinicId: null,
        subjectKey: "founder",
        periodKey: istDateKey(now),
        to,
        content: founderDigestEmail({
          newEnquiries: toDigestItems(enquiries.fresh, deps.manageUrl),
          dueFollowUps: toDigestItems(enquiries.dueFollowUps, deps.manageUrl),
          unanswered: toDigestItems(enquiries.unanswered, deps.manageUrl),
          metrics,
          operations,
        }),
        dryRun,
      }),
    );
    return tally.result();
  };
}

function founderRecipient(): string | null {
  return isConfigured(founderAlertEnv) ? founderAlertEnv().FOUNDER_ALERT_EMAIL : null;
}

export const founderDigestJob: JobFn = async (ctx) =>
  createFounderDigestJob({
    to: founderRecipient,
    enquiries: founderEnquiries,
    metrics: founderMetrics,
    ops: opsCounts,
    opsNote,
    manageUrl: enquiryManageUrl,
    sendOnce: (params) => notifier().sendOnce(params),
  })(ctx);
