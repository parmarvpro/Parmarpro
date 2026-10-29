import "server-only";

import { founderAlertEnv, isConfigured } from "@/lib/env";
import { IST, istDateKey, istDayStart } from "@/lib/ist";
import { founderDigestEmail, type DigestItem, type FounderMetrics } from "@/server/email/templates";
import { enquiryManageUrl } from "@/server/jobs/links";
import type { JobFn } from "@/server/jobs/registry";
import { createTally } from "@/server/jobs/tally";
import { founderEnquiries, founderMetrics, type EnquiryRow, type FounderEnquiries } from "@/server/privileged/jobs";
import { notifier, type SendOnceParams, type SendOutcome } from "@/server/privileged/notifications";

const DAY_MS = 24 * 60 * 60 * 1000;
const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone: IST, weekday: "short" });

export type FounderDigestDeps = {
  /** The founder's address, or null when founder alerts are not configured. */
  to: () => string | null;
  enquiries: (now: Date) => Promise<FounderEnquiries>;
  metrics: (from: Date, to: Date) => Promise<FounderMetrics>;
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
 * Daily digest for the founder: enquiries that need attention, and on Mondays
 * the platform metrics for the previous IST week. Sent once per IST day.
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
    const hasEnquiries =
      enquiries.fresh.length > 0 || enquiries.dueFollowUps.length > 0 || enquiries.unanswered.length > 0;
    if (!hasEnquiries && metrics === null) {
      tally.add("skipped_empty");
      return tally.result();
    }

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
    manageUrl: enquiryManageUrl,
    sendOnce: (params) => notifier().sendOnce(params),
  })(ctx);
