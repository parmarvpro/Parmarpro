import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import { OPS_COUNT_KEYS, type OpsCounts } from "@/lib/ops-counts";
import type { OpsNote } from "@/server/ai/features/ops-note";
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
  enquiries: 7,
};

// Synthetic counts: numbers only, as the database returns them.
const QUIET: OpsCounts = Object.fromEntries(OPS_COUNT_KEYS.map((key) => [key, 0])) as OpsCounts;
const PROBLEM: OpsCounts = { ...QUIET, job_runs: 4, job_runs_failed: 1 };
const NOTE: OpsNote = { attention: "high", note: "One job run failed. Check the staff digest log first." };

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

function harness(
  options: {
    enquiries?: FounderEnquiries;
    to?: string | null;
    ops?: (since: Date) => Promise<OpsCounts>;
    note?: OpsNote | null;
  } = {},
) {
  const to = options.to === undefined ? "founder@example.test" : options.to;
  const deps = {
    to: vi.fn<FounderDigestDeps["to"]>(() => to),
    enquiries: vi.fn<FounderDigestDeps["enquiries"]>(async () => options.enquiries ?? lists()),
    metrics: vi.fn<FounderDigestDeps["metrics"]>(async () => METRICS),
    ops: vi.fn<FounderDigestDeps["ops"]>(options.ops ?? (async () => QUIET)),
    opsNote: vi.fn<FounderDigestDeps["opsNote"]>(async () => options.note ?? null),
    manageUrl: vi.fn<FounderDigestDeps["manageUrl"]>((id) => `https://app.example.test/ops/enquiry/${id}`),
    sendOnce: vi.fn<FounderDigestDeps["sendOnce"]>(async () => "sent"),
  };
  return { deps, job: createFounderDigestJob(deps) };
}

/** The text and HTML of the one digest that was sent to the content step. */
function sentContent(deps: ReturnType<typeof harness>["deps"]) {
  const [params] = deps.sendOnce.mock.calls[0] ?? [];
  return { text: params?.content.text ?? "", html: params?.content.html ?? "" };
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
    expect(deps.ops).not.toHaveBeenCalled();
    expect(deps.sendOnce).not.toHaveBeenCalled();
  });

  it("on Monday in IST, adds last week's metrics for the previous IST week", async () => {
    const { deps, job } = harness({ enquiries: lists({ fresh: [enquiry("e1")] }) });
    await expect(job({ now: MONDAY_NIGHT, dryRun: false })).resolves.toMatchObject({ sent: 1 });
    const [from, to] = deps.metrics.mock.calls[0] ?? [];
    expect(from?.toISOString()).toBe("2026-10-25T18:30:00.000Z");
    expect(to?.toISOString()).toBe("2026-11-01T18:30:00.000Z");
    const [params] = deps.sendOnce.mock.calls[0] ?? [];
    expect(params?.content.text).toContain("Platform metrics");
    expect(params?.content.text).toContain("New clinics: 2");
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
    await expect(job({ now: TUESDAY, dryRun: false })).resolves.toMatchObject({ sent: 1 });
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
    await expect(job({ now: MONDAY_NIGHT, dryRun: false })).resolves.toMatchObject({ sent: 1 });
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

describe("founder-digest, operations", () => {
  it("reads the operations counts for the last 24 hours", async () => {
    const { deps, job } = harness({ enquiries: lists({ fresh: [enquiry("e1")] }) });
    await job({ now: TUESDAY, dryRun: false });
    expect(deps.ops).toHaveBeenCalledWith(new Date("2026-11-02T03:30:00.000Z"));
  });

  it("sends on a quiet day when operations need attention, with the section and no enquiries", async () => {
    const { deps, job } = harness({ ops: async () => PROBLEM });
    await expect(job({ now: TUESDAY, dryRun: false })).resolves.toEqual({ sent: 1, no_ai_note: 1 });
    const { text } = sentContent(deps);
    expect(text).toContain("Operations (last 24 hours)");
    expect(text).toContain("Failed job runs: 1");
    expect(text).not.toContain("New enquiries");
    expect(text).not.toContain("Platform metrics");
  });

  it("does not send on a quiet day when operations are fine, and asks for no note", async () => {
    const { deps, job } = harness({ ops: async () => QUIET });
    await expect(job({ now: TUESDAY, dryRun: false })).resolves.toEqual({ skipped_empty: 1 });
    expect(deps.sendOnce).not.toHaveBeenCalled();
    expect(deps.opsNote).not.toHaveBeenCalled();
  });

  it("names each operations count in plain words", async () => {
    const { deps, job } = harness({
      enquiries: lists({ fresh: [enquiry("e1")] }),
      ops: async () => ({ ...QUIET, job_runs: 7, emails_sent_today: 12, ai_calls_rate_limited: 2 }),
    });
    await job({ now: TUESDAY, dryRun: false });
    const { text } = sentContent(deps);
    expect(text).toContain("Job runs: 7");
    expect(text).toContain("Emails sent today: 12");
    expect(text).toContain("AI calls rate limited: 2");
    expect(text).toContain("Scheduled jobs that did not run: 0");
  });

  it("adds the AI note as a plain paragraph, and asks for it only for a digest that is sent", async () => {
    const { deps, job } = harness({ enquiries: lists({ fresh: [enquiry("e1")] }), ops: async () => PROBLEM, note: NOTE });
    await expect(job({ now: TUESDAY, dryRun: false })).resolves.toEqual({ sent: 1, ai_note: 1 });
    expect(deps.opsNote).toHaveBeenCalledTimes(1);
    expect(deps.opsNote).toHaveBeenCalledWith(PROBLEM);
    expect(sentContent(deps).text).toContain("Suggested focus (AI): One job run failed. Check the staff digest log first.");
  });

  it("shows the operations section without a suggested focus when there is no note", async () => {
    const { deps, job } = harness({ enquiries: lists({ fresh: [enquiry("e1")] }), ops: async () => PROBLEM, note: null });
    await expect(job({ now: TUESDAY, dryRun: false })).resolves.toEqual({ sent: 1, no_ai_note: 1 });
    const { text } = sentContent(deps);
    expect(text).toContain("Operations (last 24 hours)");
    expect(text).not.toContain("Suggested focus");
  });

  it("does not call the AI on a dry run, even when the digest would be sent", async () => {
    const { deps, job } = harness({ enquiries: lists({ fresh: [enquiry("e1")] }), ops: async () => PROBLEM, note: NOTE });
    const result = await job({ now: TUESDAY, dryRun: true });
    expect(result).toMatchObject({ no_ai_note: 1 });
    expect(deps.opsNote).not.toHaveBeenCalled();
    expect(deps.sendOnce).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    expect(sentContent(deps).text).not.toContain("Suggested focus");
  });

  it("still sends the enquiries when the counts cannot be read, and reports the failure with its code only", async () => {
    const { deps, job } = harness({
      enquiries: lists({ fresh: [enquiry("e1")] }),
      ops: async () => {
        throw new Error("connection to db.internal failed");
      },
      note: NOTE,
    });
    await expect(job({ now: TUESDAY, dryRun: false })).resolves.toEqual({ sent: 1, no_ai_note: 1 });
    const { text } = sentContent(deps);
    expect(text).toContain("New enquiries (1)");
    expect(text).not.toContain("Operations (last 24 hours)");
    expect(deps.opsNote).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.founder-digest", code: "ops_counts" });
  });

  it("sends nothing on a quiet day when the counts cannot be read", async () => {
    const { deps, job } = harness({
      ops: async () => {
        throw new Error("connection to db.internal failed");
      },
    });
    await expect(job({ now: TUESDAY, dryRun: false })).resolves.toEqual({ skipped_empty: 1 });
    expect(deps.sendOnce).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.founder-digest", code: "ops_counts" });
  });

  it("escapes the AI note in the HTML body, so model output cannot inject markup", async () => {
    const { deps, job } = harness({
      enquiries: lists({ fresh: [enquiry("e1")] }),
      ops: async () => PROBLEM,
      note: { attention: "high", note: "Check <script>alert(1)</script> now" },
    });
    await job({ now: TUESDAY, dryRun: false });
    const { html } = sentContent(deps);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("Check &lt;script&gt;alert(1)&lt;/script&gt; now");
  });
});
