import "server-only";

import { istDateKey } from "@/lib/ist";
import { patientReminderEmail } from "@/server/email/templates";
import { patientOptOutUrlBuilder } from "@/server/jobs/links";
import type { JobFn } from "@/server/jobs/registry";
import { createTally, forEachItem } from "@/server/jobs/tally";
import { patientReminderRows, type PatientReminderRow } from "@/server/privileged/jobs";
import { notifier, type SendOnceParams, type SendOutcome } from "@/server/privileged/notifications";

const AREA = "jobs.patient-reminders";

export type PatientRemindersDeps = {
  rows: (now: Date) => Promise<PatientReminderRow[]>;
  sendOnce: (params: SendOnceParams) => Promise<SendOutcome>;
  /** Null when opt-out links cannot be signed. Nothing is sent without one. */
  optOutUrl: ((appointmentId: string) => string) | null;
};

/** Reminders for appointments on the next IST day, one per appointment. */
export function createPatientRemindersJob(deps: PatientRemindersDeps): JobFn {
  return async ({ now, dryRun }) => {
    const tally = createTally();
    const optOutUrl = deps.optOutUrl;
    const rows = await deps.rows(now);
    await forEachItem(rows, tally, AREA, async (row) => {
      if (optOutUrl === null) {
        tally.add("skipped_no_optout_link");
        return;
      }
      const startsAt = new Date(row.starts_at);
      tally.add(
        await deps.sendOnce({
          kind: "patient_reminder",
          clinicId: row.clinic_id,
          subjectKey: row.appointment_id,
          periodKey: istDateKey(startsAt),
          to: row.email,
          content: patientReminderEmail({
            firstName: row.first_name,
            clinicName: row.clinic_name,
            startsAt,
            optOutUrl: optOutUrl(row.appointment_id),
          }),
          dryRun,
        }),
      );
    });
    return tally.result();
  };
}

export const patientRemindersJob: JobFn = async (ctx) =>
  createPatientRemindersJob({
    rows: patientReminderRows,
    sendOnce: (params) => notifier().sendOnce(params),
    optOutUrl: patientOptOutUrlBuilder(),
  })(ctx);
