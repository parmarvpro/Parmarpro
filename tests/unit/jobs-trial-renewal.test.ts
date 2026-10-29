import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import type { RecipientLookup } from "@/server/email/recipients";
import { createTrialRenewalJob, type TrialRenewalDeps } from "@/server/jobs/trial-renewal";
import type { EntitlementNoticeRow } from "@/server/privileged/jobs";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));
vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => {
    throw new Error("privileged client must not be used in this test");
  },
}));

const NOW = new Date("2026-10-29T20:00:00Z");

function row(overrides: Partial<EntitlementNoticeRow> = {}): EntitlementNoticeRow {
  return {
    clinic_id: "clinic-a",
    clinic_name: "Smile Clinic",
    notice: "trial_reminder",
    days_left: 5,
    period_key: "trial_reminder:2026-11-04",
    owner_user_ids: ["user_owner_a"],
    ...overrides,
  };
}

function harness(options: {
  rows?: EntitlementNoticeRow[];
  recipients?: Record<string, string>;
} = {}) {
  const recipients = options.recipients ?? { user_owner_a: "owner-a@example.test" };
  const lookup = vi.fn<RecipientLookup>(
    async () => new Map(Object.entries(recipients).map(([id, email]) => [id, { email, firstName: "Test" }])),
  );
  const deps = {
    rows: vi.fn<TrialRenewalDeps["rows"]>(async () => options.rows ?? [row()]),
    lookup,
    sendOnce: vi.fn<TrialRenewalDeps["sendOnce"]>(async () => "sent"),
  };
  return { deps, job: createTrialRenewalJob(deps) };
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

describe("trial-renewal", () => {
  it("sends one notice per owner, keyed by clinic and owner, with the period key from the database", async () => {
    const { deps, job } = harness({
      rows: [row({ owner_user_ids: ["user_owner_a", "user_owner_b"] })],
      recipients: { user_owner_a: "owner-a@example.test", user_owner_b: "owner-b@example.test" },
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ sent: 2 });
    expect(deps.lookup).toHaveBeenCalledWith(["user_owner_a", "user_owner_b"]);
    expect(deps.sendOnce).toHaveBeenCalledTimes(2);
    expect(deps.sendOnce).toHaveBeenNthCalledWith(1, expect.objectContaining({
      kind: "trial_reminder",
      clinicId: "clinic-a",
      subjectKey: "clinic-a:user_owner_a",
      periodKey: "trial_reminder:2026-11-04",
      to: "owner-a@example.test",
      dryRun: false,
    }));
    expect(deps.sendOnce).toHaveBeenNthCalledWith(2, expect.objectContaining({
      subjectKey: "clinic-a:user_owner_b",
      to: "owner-b@example.test",
    }));
  });

  it("builds the email with the days left and the end date from the period key", async () => {
    const { deps, job } = harness();
    await job({ now: NOW, dryRun: false });
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.subject).toBe("Your ParmarPro trial ends in 5 days");
    expect(params?.content.text).toContain("on 4 Nov 2026");
  });

  it("reads the end date as IST: a trial that ended on 28 Oct reads 28 Oct in the email", async () => {
    const { deps, job } = harness({
      rows: [row({ notice: "trial_ended", days_left: -1, period_key: "trial_ended:2026-10-28" })],
    });
    await job({ now: NOW, dryRun: false });
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.subject).toBe("Your ParmarPro trial has ended");
    expect(params?.content.text).toContain("ended on 28 Oct 2026");
  });

  it("skips an owner who has no email address", async () => {
    const { deps, job } = harness({
      rows: [row({ owner_user_ids: ["user_owner_a", "user_owner_b"] })],
      recipients: { user_owner_a: "owner-a@example.test" },
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ sent: 1, skipped_no_email: 1 });
    expect(deps.sendOnce).toHaveBeenCalledTimes(1);
  });

  it("skips a notice the email templates do not know", async () => {
    const { deps, job } = harness({ rows: [row({ notice: "mystery_notice" })] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ skipped_unknown_notice: 1 });
    expect(deps.sendOnce).not.toHaveBeenCalled();
  });

  it("refuses a period key without a usable date instead of guessing one", async () => {
    const { deps, job } = harness({ rows: [row({ period_key: "trial_reminder:soon" })] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ errors: 1 });
    expect(deps.sendOnce).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.trial-renewal" });
  });

  it("passes dry run to every send", async () => {
    const { deps, job } = harness({ rows: [row({ owner_user_ids: ["user_owner_a", "user_owner_b"] })] });
    await job({ now: NOW, dryRun: true });
    for (const [params] of deps.sendOnce.mock.calls) expect(params?.dryRun).toBe(true);
  });

  it("counts a failing send and still sends to the other owners", async () => {
    const { deps, job } = harness({
      rows: [row({ owner_user_ids: ["user_owner_a", "user_owner_b"] })],
      recipients: { user_owner_a: "owner-a@example.test", user_owner_b: "owner-b@example.test" },
    });
    deps.sendOnce.mockImplementationOnce(async () => {
      throw new Error("synthetic send failure");
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ errors: 1, sent: 1 });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.trial-renewal" });
  });

  it("returns an empty result when no notice is due", async () => {
    const { job } = harness({ rows: [] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({});
  });
});
