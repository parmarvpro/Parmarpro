import { beforeEach, describe, expect, it, vi } from "vitest";

import { formatIstDateTime } from "@/lib/ist";
import { reportError } from "@/lib/observability/report";
import { createPatientRemindersJob, type PatientRemindersDeps } from "@/server/jobs/patient-reminders";
import type { PatientReminderRow } from "@/server/privileged/jobs";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));
vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => {
    throw new Error("privileged client must not be used in this test");
  },
}));

const NOW = new Date("2026-10-29T20:00:00Z");
const STARTS_AT = "2026-10-30T10:00:00Z"; // 15:30 IST on 30 Oct

function row(overrides: Partial<PatientReminderRow> = {}): PatientReminderRow {
  return {
    appointment_id: "appt-1",
    clinic_id: "clinic-a",
    clinic_name: "Smile Clinic",
    first_name: "Asha",
    email: "asha@example.test",
    starts_at: STARTS_AT,
    ...overrides,
  };
}

function optOutFor(appointmentId: string): string {
  return `https://app.example.test/email/preferences?t=opt-out-${appointmentId}`;
}

function harness(options: { rows?: PatientReminderRow[]; optOut?: boolean } = {}) {
  const optOutUrl = vi.fn(optOutFor);
  const deps = {
    rows: vi.fn<PatientRemindersDeps["rows"]>(async () => options.rows ?? [row()]),
    sendOnce: vi.fn<PatientRemindersDeps["sendOnce"]>(async () => "sent"),
    optOutUrl: options.optOut === false ? null : optOutUrl,
  };
  return { deps, optOutUrl, job: createPatientRemindersJob(deps) };
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

describe("patient-reminders", () => {
  it("sends one reminder per appointment, keyed by appointment, with the IST day of the appointment", async () => {
    const { deps, job } = harness();
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ sent: 1 });
    expect(deps.sendOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "patient_reminder",
        clinicId: "clinic-a",
        subjectKey: "appt-1",
        periodKey: "2026-10-30",
        to: "asha@example.test",
        dryRun: false,
      }),
    );
  });

  it("puts the first name, clinic, time and opt-out link in the email, and nothing else personal", async () => {
    const { deps, job } = harness();
    await job({ now: NOW, dryRun: false });
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.text).toContain("Hi Asha,");
    expect(params?.content.text).toContain("Smile Clinic");
    expect(params?.content.text).toContain(formatIstDateTime(new Date(STARTS_AT)));
    expect(params?.content.text).toContain(`Stop appointment emails: ${optOutFor("appt-1")}`);
  });

  it("builds the opt-out link for each appointment", async () => {
    const { optOutUrl, job } = harness({ rows: [row(), row({ appointment_id: "appt-2" })] });
    await job({ now: NOW, dryRun: false });
    expect(optOutUrl).toHaveBeenCalledWith("appt-1");
    expect(optOutUrl).toHaveBeenCalledWith("appt-2");
  });

  it("sends nothing when opt-out links cannot be signed, and counts every row", async () => {
    const { deps, job } = harness({ rows: [row(), row({ appointment_id: "appt-2" })], optOut: false });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ skipped_no_optout_link: 2 });
    expect(deps.sendOnce).not.toHaveBeenCalled();
  });

  it("passes dry run to the send", async () => {
    const { deps, job } = harness();
    await job({ now: NOW, dryRun: true });
    expect(deps.sendOnce).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
  });

  it("counts a failing row as an error and still sends the next reminder", async () => {
    const { deps, job } = harness({ rows: [row(), row({ appointment_id: "appt-2" })] });
    deps.sendOnce.mockImplementationOnce(async () => {
      throw new Error("synthetic send failure");
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ errors: 1, sent: 1 });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.patient-reminders" });
  });
});
