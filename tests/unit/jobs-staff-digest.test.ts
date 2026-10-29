import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import type { RecipientLookup } from "@/server/email/recipients";
import { createStaffDigestJob, type StaffDigestDeps } from "@/server/jobs/staff-digest";
import type { StaffDigestRow } from "@/server/privileged/jobs";
import { createNotifier, type NotifierDeps } from "@/server/privileged/notifications";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));
vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => {
    throw new Error("privileged client must not be used in this test");
  },
}));

const NOW = new Date("2026-10-29T20:00:00Z");
const unsubscribeUrl = (memberId: string) => `https://app.example.test/unsubscribe/${memberId}`;

function row(overrides: Partial<StaffDigestRow> = {}): StaffDigestRow {
  return {
    clinic_id: "clinic-a",
    clinic_name: "Smile Clinic",
    member_id: "member-1",
    clerk_user_id: "user_staff_1",
    member_role: "staff",
    tasks_due_today: 0,
    tasks_overdue: 0,
    follow_ups_due_today: 0,
    follow_ups_overdue: 0,
    appointments_today: 0,
    unassigned_open_tasks: 0,
    unassigned_follow_ups: 0,
    ...overrides,
  };
}

function harness(options: { rows: StaffDigestRow[]; recipients?: string[] }) {
  const ids = options.recipients ?? options.rows.map((r) => r.clerk_user_id);
  const recipients = new Map(ids.map((id) => [id, { email: `${id}@example.test`, firstName: null }]));
  const deps = {
    rows: vi.fn<StaffDigestDeps["rows"]>(async () => options.rows),
    lookup: vi.fn<RecipientLookup>(async () => recipients),
    sendOnce: vi.fn<StaffDigestDeps["sendOnce"]>(async () => "sent"),
    unsubscribeUrl: vi.fn(unsubscribeUrl),
  };
  return { deps, job: createStaffDigestJob(deps) };
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

describe("staff-digest", () => {
  it("sends a staff member their counts, keyed by member and IST day", async () => {
    const { deps, job } = harness({ rows: [row({ tasks_due_today: 2, appointments_today: 3 })] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ sent: 1 });
    expect(deps.sendOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "staff_digest",
        clinicId: "clinic-a",
        subjectKey: "member-1",
        periodKey: "2026-10-30",
        to: "user_staff_1@example.test",
        dryRun: false,
      }),
    );
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.text).toContain("Tasks due today: 2");
    expect(params?.content.text).toContain("Appointments today: 3");
    expect(params?.content.text).toContain(`Stop these emails: ${unsubscribeUrl("member-1")}`);
  });

  it("skips a member with nothing to do, and does not look them up", async () => {
    const { deps, job } = harness({ rows: [row()] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ skipped_empty: 1 });
    expect(deps.sendOnce).not.toHaveBeenCalled();
    expect(deps.lookup).toHaveBeenCalledWith([]);
  });

  it("counts appointments as work", async () => {
    const { job } = harness({ rows: [row({ appointments_today: 1 })] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ sent: 1 });
  });

  it("includes unassigned work for an owner", async () => {
    const { deps, job } = harness({ rows: [row({ member_role: "owner", unassigned_open_tasks: 3 })] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ sent: 1 });
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.text).toContain("Unassigned open tasks: 3");
    expect(params?.content.text).toContain("Unassigned follow-ups: 0");
  });

  it("includes unassigned work for an admin", async () => {
    const { job } = harness({ rows: [row({ member_role: "admin", unassigned_follow_ups: 2 })] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ sent: 1 });
  });

  it("ignores unassigned work for staff, even when the query returns it", async () => {
    const { deps, job } = harness({ rows: [row({ unassigned_open_tasks: 5, unassigned_follow_ups: 4 })] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ skipped_empty: 1 });
    expect(deps.sendOnce).not.toHaveBeenCalled();
  });

  it("leaves the unassigned lines out of a staff member's email", async () => {
    const { deps, job } = harness({ rows: [row({ tasks_overdue: 1, unassigned_open_tasks: 5 })] });
    await job({ now: NOW, dryRun: false });
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.text).not.toContain("Unassigned");
  });

  it("skips a member who has no email address", async () => {
    const { deps, job } = harness({ rows: [row({ tasks_due_today: 1 })], recipients: [] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ skipped_no_email: 1 });
    expect(deps.sendOnce).not.toHaveBeenCalled();
  });

  it("dry run goes through the notifier without claiming or sending", async () => {
    const notifierDeps = {
      claim: vi.fn<NotifierDeps["claim"]>(async () => true),
      release: vi.fn<NotifierDeps["release"]>(async () => undefined),
      alreadySent: vi.fn<NotifierDeps["alreadySent"]>(async () => false),
      sentSince: vi.fn<NotifierDeps["sentSince"]>(async () => 0),
      send: vi.fn<NotifierDeps["send"]>(async () => ({ ok: true, id: "em_1" })),
      configured: () => true,
      now: () => NOW,
    };
    const notifier = createNotifier(notifierDeps);
    const job = createStaffDigestJob({
      rows: async () => [row({ tasks_due_today: 1 })],
      lookup: async () => new Map([["user_staff_1", { email: "user_staff_1@example.test", firstName: null }]]),
      sendOnce: (params) => notifier.sendOnce(params),
      unsubscribeUrl,
    });
    await expect(job({ now: NOW, dryRun: true })).resolves.toEqual({ dry_run: 1 });
    expect(notifierDeps.alreadySent).toHaveBeenCalledTimes(1);
    expect(notifierDeps.claim).not.toHaveBeenCalled();
    expect(notifierDeps.send).not.toHaveBeenCalled();
    expect(notifierDeps.release).not.toHaveBeenCalled();
  });

  it("counts a failing member as an error and still sends to the next one", async () => {
    const { deps, job } = harness({
      rows: [
        row({ member_id: "member-1", clerk_user_id: "user_1", tasks_due_today: 1 }),
        row({ member_id: "member-2", clerk_user_id: "user_2", tasks_due_today: 1 }),
      ],
    });
    deps.sendOnce.mockImplementationOnce(async () => {
      throw new Error("synthetic send failure");
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ errors: 1, sent: 1 });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.staff-digest" });
  });

  it("counts a member whose unsubscribe link cannot be built as an error", async () => {
    const { deps, job } = harness({ rows: [row({ tasks_due_today: 1 })] });
    deps.unsubscribeUrl.mockImplementationOnce(() => {
      throw new Error("synthetic link failure");
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ errors: 1 });
    expect(deps.sendOnce).not.toHaveBeenCalled();
  });
});
