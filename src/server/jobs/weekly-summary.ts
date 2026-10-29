import "server-only";

import { istDateKey, istWeekStart } from "@/lib/ist";
import { clerkRecipientLookup, type RecipientLookup } from "@/server/email/recipients";
import { weeklySummaryEmail } from "@/server/email/templates";
import type { JobFn } from "@/server/jobs/registry";
import { createTally, forEachItem } from "@/server/jobs/tally";
import { weeklySummaryRows, type WeeklySummaryRow } from "@/server/privileged/jobs";
import { notifier, type SendOnceParams, type SendOutcome } from "@/server/privileged/notifications";

const AREA = "jobs.weekly-summary";
const DAY_MS = 24 * 60 * 60 * 1000;

export type WeeklySummaryDeps = {
  rows: (from: Date, to: Date) => Promise<WeeklySummaryRow[]>;
  lookup: RecipientLookup;
  sendOnce: (params: SendOnceParams) => Promise<SendOutcome>;
};

/**
 * Summary of the previous IST week (Monday to Sunday) for each clinic owner.
 * The window and the period key are anchored to the Monday of the current IST
 * week, so running the job more than once a week sends nothing new.
 */
export function createWeeklySummaryJob(deps: WeeklySummaryDeps): JobFn {
  return async ({ now, dryRun }) => {
    const tally = createTally();
    const to = istWeekStart(now);
    const from = new Date(to.getTime() - 7 * DAY_MS);
    const rows = await deps.rows(from, to);
    const recipients = await deps.lookup(rows.flatMap((row) => row.owner_user_ids));
    const sends = rows.flatMap((row) => row.owner_user_ids.map((userId) => ({ row, userId })));
    await forEachItem(sends, tally, AREA, async ({ row, userId }) => {
      const recipient = recipients.get(userId);
      if (!recipient) {
        tally.add("skipped_no_email");
        return;
      }
      tally.add(
        await deps.sendOnce({
          kind: "weekly_summary",
          clinicId: row.clinic_id,
          subjectKey: `${row.clinic_id}:${userId}`,
          periodKey: istDateKey(to),
          to: recipient.email,
          content: weeklySummaryEmail({ clinicName: row.clinic_name, from, to, summary: row.summary }),
          dryRun,
        }),
      );
    });
    return tally.result();
  };
}

export const weeklySummaryJob: JobFn = async (ctx) =>
  createWeeklySummaryJob({
    rows: weeklySummaryRows,
    lookup: clerkRecipientLookup(),
    sendOnce: (params) => notifier().sendOnce(params),
  })(ctx);
