import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import { createFounderDigestJob, founderDigestJob, type FounderDigestDeps } from "@/server/jobs/founder-digest";
import type { EnquiryRow, FounderEnquiries } from "@/server/privileged/jobs";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));
vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => {
    throw new Error("privileged client must not be used in this test");
  },
}));

// 2 Nov 2026 01:30 IST is Monday. The same instant is still Sunday in UTC.
const MONDAY_NIGHT = new Date("2026-11-01T20:00:00Z");
// Tuesday 3 Nov 2026, 09:00 IST.
const TUESDAY = new Date("2026-11-03T03:30:00Z");
// Monday in UTC, but Tuesday 02:30 in IST.
const MONDAY_UTC_TUESDAY_IST = new Date("2026-11-02T20:00:00Z");

const METRICS = {
  clinics_created: 2,
  trials_active: 5,
  paid_active: 3,
  payments_captured: 1,
  revenue_paise: 8_850_000,
  enquiries: 7,
};

function enquiry(id: string, overrides: Partial<EnquiryRow> = {}): EnquiryRow {
  return {
    id,
    full_name: "Synthetic Enquiry",
    clinic_name: "Smile Clinic",
    city: "Pune",
    created_at: "2026-10-31T06:00:00Z",
    ...overrides,
  };
}

function lists(overrides: Partial<FounderEnquiries> = {}): FounderEnquiries {
  return { fresh: [], dueFollowUps: [], unanswered: [], ...overrides };
}

function harness(options: { enquiries?: FounderEnquiries; to?: string | null } = {}) {
  const to = options.to === undefined ? "founder@example.test" : options.to;
  const deps = {
    to: vi.fn<FounderDigestDeps["to"]>(() => to),
    enquiries: vi.fn<FounderDigestDeps["enquiries"]>(async () => options.enquiries ?? lists()),
    metrics: vi.fn<FounderDigestDeps["metrics"]>(async () => METRICS),
    manageUrl: vi.fn<FounderDigestDeps["manageUrl"]>((id) => `https://app.example.test/ops/enquiry/${id}`),
    sendOnce: vi.fn<FounderDigestDeps["sendOnce"]>(async () => "sent"),
  };
  return { deps, job: createFounderDigestJob(deps) };
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

describe("founder-digest", () => {
  it("does nothing and reads nothing when founder alerts are not configured", async () => {
    const { deps, job } = harness({ to: null, enquiries: lists({ fresh: [enquiry("e1")] }) });
    await expect(job({ now: MONDAY_NIGHT, dryRun: false })).resolves.toEqual({ not_configured: 1 });
    expect(deps.enquiries).not.toHaveBeenCalled();
    expect(deps.metrics).not.toHaveBeenCalled();
    expect(deps.sendOnce).not.toHaveBeenCalled();
  });

  it("on Monday in IST, adds last week's metrics for the previous IST week", async () => {
    const { deps, job } = harness({ enquiries: lists({ fresh: [enquiry("e1")] }) });
    await expect(job({ now: MONDAY_NIGHT, dryRun: false })).resolves.toEqual({ sent: 1 });
    const [from, to] = deps.metrics.mock.calls[0] ?? [];
    expect(from?.toISOString()).toBe("2026-10-25T18:30:00.000Z");
    expect(to?.toISOString()).toBe("2026-11-01T18:30:00.000Z");
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.text).toContain("Platform metrics");
    expect(params?.content.text).toContain("Trials active: 5");
  });

  it("on other days, sends no metrics", async () => {
    const { deps, job } = harness({ enquiries: lists({ fresh: [enquiry("e1")] }) });
    await job({ now: TUESDAY, dryRun: false });
    expect(deps.metrics).not.toHaveBeenCalled();
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.text).not.toContain("Platform metrics");
  });

  it("decides Monday by IST, not UTC", async () => {
    const { deps, job } = harness({ enquiries: lists({ fresh: [enquiry("e1")] }) });
    await job({ now: MONDAY_UTC_TUESDAY_IST, dryRun: false });
    expect(deps.metrics).not.toHaveBeenCalled();
  });

  it("sends the digest once per IST day to the founder, with the enquiry links", async () => {
    const { deps, job } = harness({
      enquiries: lists({
        fresh: [enquiry("e1")],
        dueFollowUps: [enquiry("e2", { city: null })],
        unanswered: [enquiry("e3")],
      }),
    });
    await expect(job({ now: TUESDAY, dryRun: false })).resolves.toEqual({ sent: 1 });
    expect(deps.sendOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "founder_digest",
        clinicId: null,
        subjectKey: "founder",
        periodKey: "2026-11-03",
        to: "founder@example.test",
        dryRun: false,
      }),
    );
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.text).toContain("New enquiries (1)");
    expect(params?.content.text).toContain("Follow-ups due (1)");
    expect(params?.content.text).toContain("Unanswered (1)");
    expect(params?.content.text).toContain("https://app.example.test/ops/enquiry/e1");
    expect(params?.content.text).toContain("https://app.example.test/ops/enquiry/e3");
  });

  it("skips an empty digest on a day without metrics", async () => {
    const { deps, job } = harness({ enquiries: lists() });
    await expect(job({ now: TUESDAY, dryRun: false })).resolves.toEqual({ skipped_empty: 1 });
    expect(deps.sendOnce).not.toHaveBeenCalled();
  });

  it("still sends on Monday when there are no enquiries, because the metrics are the content", async () => {
    const { deps, job } = harness({ enquiries: lists() });
    await expect(job({ now: MONDAY_NIGHT, dryRun: false })).resolves.toEqual({ sent: 1 });
    expect(deps.sendOnce).toHaveBeenCalledTimes(1);
  });

  it("passes dry run to the send", async () => {
    const { deps, job } = harness({ enquiries: lists({ fresh: [enquiry("e1")] }) });
    await job({ now: TUESDAY, dryRun: true });
    expect(deps.sendOnce).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
  });

  it("the production job does nothing and reads nothing when FOUNDER_ALERT_EMAIL is not set", async () => {
    vi.stubEnv("FOUNDER_ALERT_EMAIL", "");
    try {
      await expect(founderDigestJob({ now: TUESDAY, dryRun: false })).resolves.toEqual({ not_configured: 1 });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
