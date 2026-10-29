import { captureException } from "@sentry/nextjs";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";

import { istDayStart } from "@/lib/ist";
import { reportError } from "@/lib/observability/report";
import {
  AUTO_REPLY_DAILY_CAP,
  notifyEnquiry,
  type EnquiryNotice,
  type EnquiryNotificationDeps,
} from "@/server/automations/enquiry-notifications";
import type { SendOnceParams } from "@/server/privileged/notifications";

// Sentry is replaced so the scrubbing test can see what would be sent to monitoring.
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => {
    throw new Error("privileged client must not be used in this test");
  },
}));

const NOW = new Date("2026-10-29T20:00:00Z"); // 01:30 on 30 Oct IST
const ENQUIRY_ID = "5f0c2a1e-7b1d-4c8e-9f3a-2d6b8e4c1a90";

// Synthetic personal data: none of these values is a real person.
const PERSON = {
  fullName: "Synthetic Enquirer",
  phone: "+919800000077",
  email: "synthetic.enquirer@example.test",
  city: "Pune",
  message: "Synthetic message about a missed visit",
};

const NOTICE: EnquiryNotice = {
  id: ENQUIRY_ID,
  fullName: PERSON.fullName,
  clinicName: "Synthetic Dental",
  phone: PERSON.phone,
  email: PERSON.email,
  city: PERSON.city,
  message: PERSON.message,
};

type Harness = EnquiryNotificationDeps & {
  sendOnce: Mock<EnquiryNotificationDeps["sendOnce"]>;
  autoRepliesSentSince: Mock<EnquiryNotificationDeps["autoRepliesSentSince"]>;
  report: Mock<EnquiryNotificationDeps["report"]>;
  manageUrl: Mock<EnquiryNotificationDeps["manageUrl"]>;
};

function harness(
  options: { founder?: string | null; sentToday?: number; countError?: Error; sendError?: Error } = {},
): Harness {
  const deps: Harness = {
    founderAddress: vi.fn(() => (options.founder === undefined ? "founder@example.test" : options.founder)),
    manageUrl: vi.fn((id: string) => `https://app.example.test/ops/enquiry/${id}?t=link`),
    autoRepliesSentSince: vi.fn(async () => {
      if (options.countError) throw options.countError;
      return options.sentToday ?? 0;
    }),
    sendOnce: vi.fn<EnquiryNotificationDeps["sendOnce"]>(async () => {
      if (options.sendError) throw options.sendError;
      return "sent";
    }),
    report: vi.fn(),
    now: () => NOW,
  };
  return deps;
}

function sentParams(deps: Harness): SendOnceParams[] {
  return deps.sendOnce.mock.calls.map(([params]) => params);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("founder alert", () => {
  it("is not sent, and nothing is read, when founder alerts are not configured", async () => {
    const deps = harness({ founder: null });
    await notifyEnquiry(NOTICE, deps);
    expect(sentParams(deps).filter((params) => params.kind === "enquiry_alert")).toEqual([]);
    expect(deps.manageUrl).not.toHaveBeenCalled();
  });

  it("is sent once to the founder with the enquiry, its manage link and no clinic id", async () => {
    const deps = harness();
    await notifyEnquiry(NOTICE, deps);
    const [alert] = sentParams(deps).filter((params) => params.kind === "enquiry_alert");
    expect(alert).toMatchObject({
      kind: "enquiry_alert",
      clinicId: null,
      subjectKey: ENQUIRY_ID,
      periodKey: "once",
      to: "founder@example.test",
      dryRun: false,
    });
    expect(alert?.content.subject).toBe("New enquiry: Synthetic Enquirer — Synthetic Dental");
    expect(alert?.content.text).toContain(PERSON.phone);
    expect(alert?.content.text).toContain(`https://app.example.test/ops/enquiry/${ENQUIRY_ID}?t=link`);
    expect(deps.manageUrl).toHaveBeenCalledWith(ENQUIRY_ID);
  });
});

describe("auto-reply to the submitter", () => {
  it("is not sent, and the daily count is not read, when the submitter gave no email", async () => {
    const deps = harness();
    await notifyEnquiry({ ...NOTICE, email: null }, deps);
    expect(sentParams(deps).some((params) => params.kind === "enquiry_auto_reply")).toBe(false);
    expect(deps.autoRepliesSentSince).not.toHaveBeenCalled();
  });

  it("is sent to the submitter's address, keyed by the enquiry, with the first name only", async () => {
    const deps = harness();
    await notifyEnquiry(NOTICE, deps);
    const [reply] = sentParams(deps).filter((params) => params.kind === "enquiry_auto_reply");
    expect(reply).toMatchObject({
      kind: "enquiry_auto_reply",
      clinicId: null,
      subjectKey: ENQUIRY_ID,
      periodKey: "once",
      to: PERSON.email,
      dryRun: false,
    });
    expect(reply?.content.text.startsWith("Hi Synthetic,")).toBe(true);
    expect(reply?.content.text).not.toContain("Enquirer");
  });

  it("counts the IST day that started at the last IST midnight", async () => {
    const deps = harness();
    await notifyEnquiry(NOTICE, deps);
    expect(deps.autoRepliesSentSince).toHaveBeenCalledWith(istDayStart(NOW));
  });

  it("is sent while the daily count is below the cap", async () => {
    const deps = harness({ sentToday: AUTO_REPLY_DAILY_CAP - 1 });
    await notifyEnquiry(NOTICE, deps);
    expect(sentParams(deps).some((params) => params.kind === "enquiry_auto_reply")).toBe(true);
  });

  it("is skipped once the daily count reaches the cap", async () => {
    const deps = harness({ sentToday: AUTO_REPLY_DAILY_CAP });
    await notifyEnquiry(NOTICE, deps);
    expect(sentParams(deps).some((params) => params.kind === "enquiry_auto_reply")).toBe(false);
    expect(sentParams(deps).some((params) => params.kind === "enquiry_alert")).toBe(true);
  });

  it("keeps the cap at 50 a day", () => {
    expect(AUTO_REPLY_DAILY_CAP).toBe(50);
  });
});

describe("failures", () => {
  it("are reported under the enquiry area and never thrown", async () => {
    const deps = harness({ sendError: new Error("provider unavailable") });
    await expect(notifyEnquiry(NOTICE, deps)).resolves.toBeUndefined();
    expect(deps.report).toHaveBeenCalledWith(expect.any(Error), { area: "automations.enquiry" });
  });

  it("do not stop the other email", async () => {
    const deps = harness({ sendError: new Error("provider unavailable") });
    await notifyEnquiry(NOTICE, deps);
    // The founder alert failed, but the auto-reply was still attempted.
    expect(sentParams(deps).some((params) => params.kind === "enquiry_auto_reply")).toBe(true);
  });

  it("a failed count is reported and sends no auto-reply, but the founder alert still goes out", async () => {
    const deps = harness({ countError: new Error("count failed") });
    await expect(notifyEnquiry(NOTICE, deps)).resolves.toBeUndefined();
    expect(sentParams(deps).map((params) => params.kind)).toEqual(["enquiry_alert"]);
    expect(deps.report).toHaveBeenCalledTimes(1);
  });

  it("reports the scrubbed error only: no personal data reaches monitoring or the log", async () => {
    vi.mocked(captureException).mockClear();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const leaky = new Error(`Failing row contains (${PERSON.fullName}, ${PERSON.email}, ${PERSON.phone})`);
    const deps = harness({ sendError: leaky });
    deps.report = vi.fn((error: unknown, context: { area: string }) => reportError(error, context));

    await notifyEnquiry(NOTICE, deps);

    // Both emails failed, so both failures are reported, each as its class and code only.
    const sentToMonitoring = vi.mocked(captureException).mock.calls.map(([error]) => (error as Error).message);
    expect(sentToMonitoring).toEqual(["Error:unknown", "Error:unknown"]);
    expect(consoleError.mock.calls).toEqual([["[automations.enquiry] Error:unknown"], ["[automations.enquiry] Error:unknown"]]);
    const logged = consoleError.mock.calls.flat().join(" ");
    for (const value of [PERSON.fullName, PERSON.email, PERSON.phone]) {
      expect(sentToMonitoring.join(" ")).not.toContain(value);
      expect(logged).not.toContain(value);
    }
  });
});
