import "server-only";

import { istDateKey } from "@/lib/ist";
import { clerkRecipientLookup, type RecipientLookup } from "@/server/email/recipients";
import { staffDigestEmail, type StaffCounts } from "@/server/email/templates";
import { digestUnsubscribeUrl } from "@/server/jobs/links";
import type { JobFn } from "@/server/jobs/registry";
import { createTally, forEachItem } from "@/server/jobs/tally";
import { staffDigestRows, type StaffDigestRow } from "@/server/privileged/jobs";
import { notifier, type SendOnceParams, type SendOutcome } from "@/server/privileged/notifications";

const AREA = "jobs.staff-digest";

export type StaffDigestDeps = {
  rows: (now: Date) => Promise<StaffDigestRow[]>;
  lookup: RecipientLookup;
  sendOnce: (params: SendOnceParams) => Promise<SendOutcome>;
  unsubscribeUrl: (memberId: string) => string;
};

type Digest = { row: StaffDigestRow; isManager: boolean; counts: StaffCounts };

/**
 * Counts for one member. Only owners and admins see unassigned work, so the
 * unassigned counts are zero for everyone else, whatever the query returned.
 */
function digestFor(row: StaffDigestRow): Digest {
  const isManager = row.member_role === "owner" || row.member_role === "admin";
  return {
    row,
    isManager,
    counts: {
      tasksDueToday: row.tasks_due_today,
      tasksOverdue: row.tasks_overdue,
      followUpsDueToday: row.follow_ups_due_today,
      followUpsOverdue: row.follow_ups_overdue,
      appointmentsToday: row.appointments_today,
      unassignedOpenTasks: isManager ? row.unassigned_open_tasks : 0,
      unassignedFollowUps: isManager ? row.unassigned_follow_ups : 0,
    },
  };
}

/** All seven counts. A digest with nothing in any of them is not sent. */
function total(counts: StaffCounts): number {
  return (
    counts.tasksDueToday +
    counts.tasksOverdue +
    counts.followUpsDueToday +
    counts.followUpsOverdue +
    counts.appointmentsToday +
    counts.unassignedOpenTasks +
    counts.unassignedFollowUps
  );
}

/** Morning digest of counts, one email per active member. Counts only: no names of patients, leads or colleagues. */
export function createStaffDigestJob(deps: StaffDigestDeps): JobFn {
  return async ({ now, dryRun }) => {
    const tally = createTally();
    const digests: Digest[] = [];
    for (const row of await deps.rows(now)) {
      const digest = digestFor(row);
      if (total(digest.counts) === 0) tally.add("skipped_empty");
      else digests.push(digest);
    }
    const recipients = await deps.lookup(digests.map((digest) => digest.row.clerk_user_id));
    await forEachItem(digests, tally, AREA, async ({ row, isManager, counts }) => {
      const recipient = recipients.get(row.clerk_user_id);
      if (!recipient) {
        tally.add("skipped_no_email");
        return;
      }
      tally.add(
        await deps.sendOnce({
          kind: "staff_digest",
          clinicId: row.clinic_id,
          subjectKey: row.member_id,
          periodKey: istDateKey(now),
          to: recipient.email,
          content: staffDigestEmail({
            clinicName: row.clinic_name,
            isManager,
            counts,
            unsubscribeUrl: deps.unsubscribeUrl(row.member_id),
          }),
          dryRun,
        }),
      );
    });
    return tally.result();
  };
}

export const staffDigestJob: JobFn = async (ctx) =>
  createStaffDigestJob({
    rows: staffDigestRows,
    lookup: clerkRecipientLookup(),
    sendOnce: (params) => notifier().sendOnce(params),
    unsubscribeUrl: digestUnsubscribeUrl,
  })(ctx);
