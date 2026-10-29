import { describe, expect, it } from "vitest";

import { publicEnv } from "@/lib/env";
import { formatIstDate, formatIstDateTime } from "@/lib/ist";
import { formatInr } from "@/lib/plans";
import {
  enquiryAlertEmail,
  enquiryAutoReplyEmail,
  entitlementNoticeEmail,
  escapeHtml,
  founderDigestEmail,
  paymentReceiptEmail,
  patientReminderEmail,
  staffDigestEmail,
  welcomeEmail,
  weeklySummaryEmail,
  type EntitlementNotice,
  type StaffCounts,
} from "@/server/email/templates";

const APP = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
const UNSUBSCRIBE = "https://app.example.test/digest/unsubscribe?t=token-value";
const MANAGE = "https://app.example.test/founder/enquiries/abc?t=token-value";

const COUNTS: StaffCounts = {
  tasksDueToday: 2,
  tasksOverdue: 3,
  followUpsDueToday: 1,
  followUpsOverdue: 4,
  appointmentsToday: 6,
  unassignedOpenTasks: 7,
  unassignedFollowUps: 8,
};

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters exactly once", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;");
  });
});

describe("enquiry alert (founder)", () => {
  const createdAt = new Date("2026-10-30T05:00:00Z");

  it("lists every field and links to the enquiry", () => {
    const email = enquiryAlertEmail({
      fullName: "Asha Rao",
      clinicName: "Smile Clinic",
      phone: "+919812345678",
      email: "asha@example.com",
      city: "Pune",
      message: "Line one\nLine two",
      createdAt,
      manageUrl: MANAGE,
    });
    expect(email.subject).toBe("New enquiry: Asha Rao — Smile Clinic");
    for (const value of ["Asha Rao", "Smile Clinic", "+919812345678", "asha@example.com", "Pune", "Line one\nLine two"]) {
      expect(email.text).toContain(value);
      expect(email.html).toContain(escapeHtml(value));
    }
    expect(email.text).toContain(formatIstDateTime(createdAt));
    expect(email.text).toContain(`Open enquiry: ${MANAGE}`);
    expect(email.html).toContain(`href="${escapeHtml(MANAGE)}"`);
  });

  it("omits the clinic from the subject when there is none and shows a dash for missing fields", () => {
    const email = enquiryAlertEmail({
      fullName: "Asha Rao",
      clinicName: null,
      phone: null,
      email: null,
      city: null,
      message: null,
      createdAt,
      manageUrl: MANAGE,
    });
    expect(email.subject).toBe("New enquiry: Asha Rao");
    expect(email.text).toContain("Clinic: —");
  });

  it("escapes markup in the name for HTML and keeps the raw text in the plain-text part", () => {
    const email = enquiryAlertEmail({
      fullName: "<script>alert(1)</script>",
      clinicName: null,
      phone: null,
      email: null,
      city: null,
      message: null,
      createdAt,
      manageUrl: MANAGE,
    });
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.text).toContain("<script>alert(1)</script>");
  });

  it("refuses a manage link that is not an absolute http(s) URL", () => {
    expect(() =>
      enquiryAlertEmail({
        fullName: "A",
        clinicName: null,
        phone: null,
        email: null,
        city: null,
        message: null,
        createdAt,
        manageUrl: "javascript:alert(1)",
      }),
    ).toThrow();
  });
});

describe("enquiry auto-reply", () => {
  it("greets by the first word only and carries no other personal data", () => {
    const email = enquiryAutoReplyEmail({ fullName: "Asha Rao" });
    expect(email.subject).toBe("Thanks for contacting ParmarPro");
    expect(email.text).toContain("Hi Asha,");
    expect(email.text).not.toContain("Rao");
    expect(email.text).toContain("within one working day");
  });

  it("falls back to a neutral greeting when the name is blank", () => {
    expect(enquiryAutoReplyEmail({ fullName: "   " }).text).toMatch(/^Hello,/);
  });
});

describe("welcome", () => {
  it("states the trial end date in IST and links to the dashboard", () => {
    const trialEndsAt = new Date("2026-11-11T18:29:00Z");
    const email = welcomeEmail({ firstName: "Ravi", clinicName: "Smile Clinic", trialEndsAt });
    expect(email.subject).toBe("Welcome to ParmarPro");
    expect(email.text).toContain("Hi Ravi,");
    expect(email.text).toContain(`free trial runs until ${formatIstDate(trialEndsAt)}`);
    expect(email.text).toContain(`${APP}/dashboard`);
  });
});

describe("entitlement notices", () => {
  const endsAt = new Date("2026-11-03T18:30:00Z");
  const cases: Array<[EntitlementNotice, number]> = [
    ["trial_reminder", 5],
    ["trial_ending", 1],
    ["trial_ended", -1],
    ["renewal_reminder", 3],
    ["renewal_due", 0],
    ["access_lapsed", -1],
  ];

  it("gives each notice a distinct subject", () => {
    const subjects = cases.map(([notice, daysLeft]) =>
      entitlementNoticeEmail({ notice, clinicName: "Smile Clinic", daysLeft, endsAt }).subject,
    );
    expect(new Set(subjects).size).toBe(cases.length);
  });

  it("uses the documented subjects", () => {
    const subject = (notice: EntitlementNotice, daysLeft: number) =>
      entitlementNoticeEmail({ notice, clinicName: "Smile Clinic", daysLeft, endsAt }).subject;
    expect(subject("trial_reminder", 5)).toBe("Your ParmarPro trial ends in 5 days");
    expect(subject("trial_ending", 0)).toBe("Your ParmarPro trial ends today");
    expect(subject("trial_ending", 1)).toBe("Your ParmarPro trial ends in 1 day");
    expect(subject("trial_ended", -1)).toBe("Your ParmarPro trial has ended");
    expect(subject("renewal_reminder", 3)).toBe("Your ParmarPro plan renews in 3 days");
    expect(subject("renewal_due", 0)).toBe("Renew today to keep editing");
    expect(subject("renewal_due", 1)).toBe("Renew tomorrow to keep editing");
    expect(subject("access_lapsed", -1)).toBe("Your ParmarPro plan has lapsed");
  });

  it("says records stay readable and links to billing settings in every notice", () => {
    for (const [notice, daysLeft] of cases) {
      const email = entitlementNoticeEmail({ notice, clinicName: "Smile Clinic", daysLeft, endsAt });
      expect(email.text).toContain("your records stay readable");
      expect(email.text).toContain(`${APP}/dashboard/settings/billing`);
      expect(email.html).toContain(`${APP}/dashboard/settings/billing`);
    }
  });
});

describe("payment receipt", () => {
  it("shows the amount and states that it is not a GST tax invoice", () => {
    const email = paymentReceiptEmail({
      clinicName: "Smile Clinic",
      amountPaise: 8_850_000,
      paidThrough: new Date("2026-11-29T18:30:00Z"),
      providerPaymentId: "pay_ABC123",
      paidAt: new Date("2026-10-29T05:00:00Z"),
    });
    expect(email.subject).toBe("Payment received for Smile Clinic");
    expect(email.text).toContain(formatInr(8_850_000));
    expect(email.text).toContain("pay_ABC123");
    expect(email.text).toContain("This is a payment confirmation, not a GST tax invoice.");
    expect(email.html).toContain("not a GST tax invoice");
  });
});

describe("staff digest", () => {
  it("counts overdue and due-today tasks and follow-ups as to-dos, and names today's appointments", () => {
    const email = staffDigestEmail({ clinicName: "Smile Clinic", isManager: false, counts: COUNTS, unsubscribeUrl: UNSUBSCRIBE });
    // 2 + 3 + 1 + 4. Unassigned counts are not in the subject.
    expect(email.subject).toBe("Today at Smile Clinic: 10 to do, 6 appointments");
  });

  it("does not say '0 to do' without context when only appointments are due", () => {
    const counts = { ...COUNTS, tasksDueToday: 0, tasksOverdue: 0, followUpsDueToday: 0, followUpsOverdue: 0, appointmentsToday: 1 };
    const email = staffDigestEmail({ clinicName: "Smile Clinic", isManager: false, counts, unsubscribeUrl: UNSUBSCRIBE });
    expect(email.subject).toBe("Today at Smile Clinic: 0 to do, 1 appointment");
  });

  it("shows unassigned lines only to owners and admins", () => {
    const staff = staffDigestEmail({ clinicName: "Smile Clinic", isManager: false, counts: COUNTS, unsubscribeUrl: UNSUBSCRIBE });
    expect(staff.text).not.toContain("Unassigned");
    expect(staff.html).not.toContain("Unassigned");

    const manager = staffDigestEmail({ clinicName: "Smile Clinic", isManager: true, counts: COUNTS, unsubscribeUrl: UNSUBSCRIBE });
    expect(manager.text).toContain("Unassigned open tasks: 7");
    expect(manager.text).toContain("Unassigned follow-ups: 8");
  });

  it("links to the dashboard and to the unsubscribe URL in the footer", () => {
    const email = staffDigestEmail({ clinicName: "Smile Clinic", isManager: false, counts: COUNTS, unsubscribeUrl: UNSUBSCRIBE });
    expect(email.text).toContain(`${APP}/dashboard`);
    expect(email.text).toContain(`Stop these emails: ${UNSUBSCRIBE}`);
    expect(email.html).toContain(`href="${escapeHtml(UNSUBSCRIBE)}"`);
  });
});

describe("weekly summary", () => {
  it("shows the counts and the IST period, treating the end as exclusive", () => {
    const email = weeklySummaryEmail({
      clinicName: "Smile Clinic",
      from: new Date("2026-10-25T18:30:00Z"), // 26 Oct IST
      to: new Date("2026-11-01T18:30:00Z"), // 2 Nov IST, exclusive
      summary: {
        leads_created: 12,
        leads_converted: 3,
        appointments_in_range: 9,
        tasks_completed: 15,
        tasks_overdue: 2,
        follow_ups_due: 4,
        patients_total: 210,
      },
    });
    expect(email.text).toContain("26 Oct 2026 to 1 Nov 2026");
    expect(email.text).toContain("New leads: 12");
    expect(email.text).toContain("Patients on record: 210");
  });
});

describe("patient reminder", () => {
  const startsAt = new Date("2026-10-30T04:30:00Z"); // 10:00 IST on 30 Oct
  const OPT_OUT = "https://app.example.test/patient/opt-out?t=token-value";

  it("carries only the first name, clinic, time and a contact line", () => {
    const email = patientReminderEmail({ firstName: "Meera", clinicName: "Smile Clinic", startsAt, optOutUrl: OPT_OUT });
    expect(email.subject).toBe("Reminder: your appointment at Smile Clinic");
    expect(email.text).toContain("Hi Meera,");
    expect(email.text).toContain("Smile Clinic");
    expect(email.text).toContain(formatIstDateTime(startsAt));
    expect(email.text).toContain("Please contact the clinic if you need to change it.");
    expect(email.text.toLowerCase()).not.toContain("treatment");
    expect(email.html.toLowerCase()).not.toContain("treatment");
  });

  it("offers an opt-out link in the footer", () => {
    const email = patientReminderEmail({ firstName: "Meera", clinicName: "Smile Clinic", startsAt, optOutUrl: OPT_OUT });
    expect(email.text).toContain(`Stop appointment emails: ${OPT_OUT}`);
    expect(email.html).toContain(`href="${escapeHtml(OPT_OUT)}"`);
  });
});

describe("founder digest", () => {
  const item = (fullName: string) => ({
    fullName,
    clinicName: "Smile Clinic",
    city: "Pune",
    createdAt: new Date("2026-10-29T05:00:00Z"),
    url: `${APP}/founder/enquiries/${fullName.toLowerCase()}`,
  });

  it("uses the new enquiry count in the subject", () => {
    const email = founderDigestEmail({ newEnquiries: [item("A"), item("B")], dueFollowUps: [], unanswered: [], metrics: null });
    expect(email.subject).toBe("ParmarPro daily: 2 new enquiries");
  });

  it("shows only the sections that have items", () => {
    const email = founderDigestEmail({ newEnquiries: [item("A")], dueFollowUps: [], unanswered: [], metrics: null });
    expect(email.text).toContain("New enquiries (1)");
    expect(email.text).not.toContain("Follow-ups due");
    expect(email.text).not.toContain("Unanswered");
    expect(email.text).not.toContain("Platform metrics");
  });

  it("shows the metrics section with revenue formatted in rupees when metrics are given", () => {
    const email = founderDigestEmail({
      newEnquiries: [],
      dueFollowUps: [],
      unanswered: [],
      metrics: {
        clinics_created: 2,
        trials_active: 5,
        paid_active: 3,
        payments_captured: 3,
        revenue_paise: 26_550_000,
        enquiries: 9,
      },
    });
    expect(email.text).toContain("Platform metrics");
    expect(email.text).toContain(`Revenue: ${formatInr(26_550_000)}`);
  });

  it("says so when there is nothing to report", () => {
    const email = founderDigestEmail({ newEnquiries: [], dueFollowUps: [], unanswered: [], metrics: null });
    expect(email.subject).toBe("ParmarPro daily: 0 new enquiries");
    expect(email.text).toContain("Nothing needs attention today.");
  });
});

describe("every email", () => {
  it("has a plain-text part, a footer with the app URL, no images and no tracking pixels", () => {
    const emails = [
      enquiryAutoReplyEmail({ fullName: "Asha Rao" }),
      welcomeEmail({ firstName: null, clinicName: "Smile Clinic", trialEndsAt: new Date("2026-11-11T00:00:00Z") }),
      staffDigestEmail({ clinicName: "Smile Clinic", isManager: true, counts: COUNTS, unsubscribeUrl: UNSUBSCRIBE }),
      founderDigestEmail({ newEnquiries: [], dueFollowUps: [], unanswered: [], metrics: null }),
    ];
    for (const email of emails) {
      expect(email.text.length).toBeGreaterThan(0);
      expect(email.text).toContain(`ParmarPro · ${APP}`);
      expect(email.html.startsWith("<!doctype html>")).toBe(true);
      expect(email.html).not.toMatch(/<img/i);
    }
  });
});
