import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import type { RecipientLookup } from "@/server/email/recipients";
import { createWeeklySummaryJob, type WeeklySummaryDeps } from "@/server/jobs/weekly-summary";
import type { WeeklySummaryRow } from "@/server/privileged/jobs";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));
vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => {
    throw new Error("privileged client must not be used in this test");
  },
}));

// Monday 2 Nov 2026, 09:00 IST. The summary covers 26 Oct to 1 Nov, IST.
const NOW = new Date("2026-11-02T03:30:00Z");

function row(overrides: Partial<WeeklySummaryRow> = {}): WeeklySummaryRow {
  return {
    clinic_id: "clinic-a",
    clinic_name: "Smile Clinic",
    owner_user_ids: ["user_owner_a"],
    summary: {
      leads_created: 4,
      leads_converted: 1,
      appointments_in_range: 6,
      tasks_completed: 3,
      tasks_overdue: 2,
      follow_ups_due: 1,
      patients_total: 120,
    },
    ...overrides,
  };
}

function harness(options: { rows?: WeeklySummaryRow[]; recipients?: Record<string, string> } = {}) {
  const recipients = options.recipients ?? { user_owner_a: "owner-a@example.test" };
  const deps = {
    rows: vi.fn<WeeklySummaryDeps["rows"]>(async () => options.rows ?? [row()]),
    lookup: vi.fn<RecipientLookup>(
      async () => new Map(Object.entries(recipients).map(([id, email]) => [id, { email, firstName: null }])),
    ),
    sendOnce: vi.fn<WeeklySummaryDeps["sendOnce"]>(async () => "sent"),
  };
  return { deps, job: createWeeklySummaryJob(deps) };
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

describe("weekly-summary", () => {
  it("covers the seven IST days before today, and asks the database for exactly that window", async () => {
    const { deps, job } = harness();
    await job({ now: NOW, dryRun: false });
    const [from, to] = deps.rows.mock.calls[0] ?? [];
    expect(from?.toISOString()).toBe("2026-10-25T18:30:00.000Z");
    expect(to?.toISOString()).toBe("2026-11-01T18:30:00.000Z");
  });

  it("uses the same window and period key on any day of the same IST week, so a repeat run sends nothing new", async () => {
    const monday = harness();
    await monday.job({ now: NOW, dryRun: false });
    const wednesday = harness();
    await wednesday.job({ now: new Date(NOW.getTime() + 2 * 24 * 60 * 60 * 1000), dryRun: false });
    expect(wednesday.deps.rows.mock.calls[0]).toEqual(monday.deps.rows.mock.calls[0]);
    const keyOf = (h: ReturnType<typeof harness>) => h.deps.sendOnce.mock.calls[0]?.[0]?.periodKey;
    expect(keyOf(wednesday)).toBe(keyOf(monday));
  });

  it("sends each owner the summary, keyed by clinic and owner, with the IST date of the week's end", async () => {
    const { deps, job } = harness({
      rows: [row({ owner_user_ids: ["user_owner_a", "user_owner_b"] })],
      recipients: { user_owner_a: "owner-a@example.test", user_owner_b: "owner-b@example.test" },
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ sent: 2 });
    expect(deps.sendOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "weekly_summary",
        clinicId: "clinic-a",
        subjectKey: "clinic-a:user_owner_a",
        periodKey: "2026-11-02",
        to: "owner-a@example.test",
      }),
    );
    expect(deps.sendOnce).toHaveBeenCalledWith(expect.objectContaining({ subjectKey: "clinic-a:user_owner_b" }));
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.subject).toBe("Weekly summary for Smile Clinic");
    expect(params?.content.text).toContain("26 Oct 2026 to 1 Nov 2026");
    expect(params?.content.text).toContain("New leads: 4");
    expect(params?.content.text).toContain("Patients on record: 120");
  });

  it("skips an owner who has no email address", async () => {
    const { deps, job } = harness({
      rows: [row({ owner_user_ids: ["user_owner_a", "user_owner_b"] })],
      recipients: { user_owner_a: "owner-a@example.test" },
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ sent: 1, skipped_no_email: 1 });
    expect(deps.sendOnce).toHaveBeenCalledTimes(1);
  });

  it("passes dry run to every send", async () => {
    const { deps, job } = harness();
    await job({ now: NOW, dryRun: true });
    expect(deps.sendOnce).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
  });

  it("counts a failing send and still sends to the next owner", async () => {
    const { deps, job } = harness({
      rows: [row({ owner_user_ids: ["user_owner_a", "user_owner_b"] })],
      recipients: { user_owner_a: "owner-a@example.test", user_owner_b: "owner-b@example.test" },
    });
    deps.sendOnce.mockImplementationOnce(async () => {
      throw new Error("synthetic send failure");
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ errors: 1, sent: 1 });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.weekly-summary" });
  });
});
