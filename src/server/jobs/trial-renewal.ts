import "server-only";

import { clerkRecipientLookup, type RecipientLookup } from "@/server/email/recipients";
import { entitlementNoticeEmail, type EntitlementNotice } from "@/server/email/templates";
import type { JobFn } from "@/server/jobs/registry";
import { createTally, forEachItem } from "@/server/jobs/tally";
import { entitlementNoticeRows, type EntitlementNoticeRow } from "@/server/privileged/jobs";
import { notifier, type SendOnceParams, type SendOutcome } from "@/server/privileged/notifications";

const AREA = "jobs.trial-renewal";

/** Every notice the database can produce. A missing or extra notice fails to compile against EntitlementNotice. */
const NOTICES: Record<EntitlementNotice, true> = {
  trial_reminder: true,
  trial_ending: true,
  trial_ended: true,
  renewal_reminder: true,
  renewal_due: true,
  access_lapsed: true,
};

function isEntitlementNotice(value: string): value is EntitlementNotice {
  return Object.hasOwn(NOTICES, value);
}

/**
 * The end date the database appended to period_key ("trial_reminder:2026-11-04"),
 * as IST midnight at the start of that day.
 */
function endsAtFrom(periodKey: string): Date {
  const datePart = periodKey.slice(periodKey.indexOf(":") + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) throw new Error("trial_renewal_period_key");
  const endsAt = new Date(`${datePart}T00:00:00+05:30`);
  if (Number.isNaN(endsAt.getTime())) throw new Error("trial_renewal_period_key");
  return endsAt;
}

export type TrialRenewalDeps = {
  rows: (now: Date) => Promise<EntitlementNoticeRow[]>;
  lookup: RecipientLookup;
  sendOnce: (params: SendOnceParams) => Promise<SendOutcome>;
};

/** Trial and renewal notices, one email per clinic owner. Each notice is sent once per period. */
export function createTrialRenewalJob(deps: TrialRenewalDeps): JobFn {
  return async ({ now, dryRun }) => {
    const tally = createTally();
    const rows = await deps.rows(now);
    const recipients = await deps.lookup(rows.flatMap((row) => row.owner_user_ids));
    const sends = rows.flatMap((row) => row.owner_user_ids.map((userId) => ({ row, userId })));
    await forEachItem(sends, tally, AREA, async ({ row, userId }) => {
      const notice = row.notice;
      if (!isEntitlementNotice(notice)) {
        tally.add("skipped_unknown_notice");
        return;
      }
      const recipient = recipients.get(userId);
      if (!recipient) {
        tally.add("skipped_no_email");
        return;
      }
      tally.add(
        await deps.sendOnce({
          kind: notice,
          clinicId: row.clinic_id,
          subjectKey: `${row.clinic_id}:${userId}`,
          periodKey: row.period_key,
          to: recipient.email,
          content: entitlementNoticeEmail({
            notice,
            clinicName: row.clinic_name,
            daysLeft: row.days_left,
            endsAt: endsAtFrom(row.period_key),
          }),
          dryRun,
        }),
      );
    });
    return tally.result();
  };
}

export const trialRenewalJob: JobFn = async (ctx) =>
  createTrialRenewalJob({
    rows: entitlementNoticeRows,
    lookup: clerkRecipientLookup(),
    sendOnce: (params) => notifier().sendOnce(params),
  })(ctx);
