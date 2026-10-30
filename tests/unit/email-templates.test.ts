import { describe, expect, it } from "vitest";

import { publicEnv } from "@/lib/env";
import { formatIstDateTime } from "@/lib/ist";
import {
  enquiryAlertEmail,
  enquiryAutoReplyEmail,
  escapeHtml,
  founderDigestEmail,
  patientReminderEmail,
  staffDigestEmail,
  welcomeEmail,
  weeklySummaryEmail,
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
  it("greets by first name, names the clinic and links to the dashboard", () => {
    const email = welcomeEmail({ firstName: "Ravi", clinicName: "Smile Clinic" });
    expect(email.subject).toBe("Welcome to ParmarPro");
    expect(email.text).toContain("Hi Ravi,");
    expect(email.text).toContain("Your clinic, Smile Clinic, is set up and ready to use.");
    expect(email.text).not.toContain("trial");
    expect(email.text).toContain(`${APP}/dashboard`);
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

  it("shows the platform metrics section when metrics are given", () => {
    const email = founderDigestEmail({
      newEnquiries: [],
      dueFollowUps: [],
      unanswered: [],
      metrics: {
        clinics_created: 2,
        enquiries: 9,
      },
    });
    expect(email.text).toContain("Platform metrics");
    expect(email.text).toContain("New clinics: 2");
    expect(email.text).toContain("Enquiries: 9");
  });

  it("says so when there is nothing to report", () => {
    const email = founderDigestEmail({ newEnquiries: [], dueFollowUps: [], unanswered: [], metrics: null });
    expect(email.subject).toBe("ParmarPro daily: 0 new enquiries");
    expect(email.text).toContain("Nothing needs attention today.");
  });

  it("uses the singular for one new enquiry", () => {
    const one = { fullName: "Synthetic Enquirer", clinicName: null, city: null, createdAt: new Date(), url: "https://app.example.test/x" };
    const email = founderDigestEmail({ newEnquiries: [one], dueFollowUps: [], unanswered: [], metrics: null });
    expect(email.subject).toBe("ParmarPro daily: 1 new enquiry");
  });

  const OPS_COUNTS = {
    job_runs: 6,
    job_runs_failed: 1,
    jobs_not_run: 0,
    emails_failed: 0,
    email_budget_hits: 0,
    emails_sent_today: 4,
    webhooks_failed: 0,
    ai_calls: 3,
    ai_calls_failed: 0,
    ai_calls_rate_limited: 1,
  };

  it("says in the subject when operations need attention, and not otherwise", () => {
    const base = { newEnquiries: [], dueFollowUps: [], unanswered: [], metrics: null };
    const failing = founderDigestEmail({ ...base, operations: { counts: OPS_COUNTS, note: null } });
    expect(failing.subject).toBe("ParmarPro daily: 0 new enquiries, operations need attention");
    const quiet = { ...OPS_COUNTS, job_runs_failed: 0 };
    expect(founderDigestEmail({ ...base, operations: { counts: quiet, note: null } }).subject).toBe(
      "ParmarPro daily: 0 new enquiries",
    );
  });

  it("shows the operations counts in plain words, in order, with the AI note as plain text", () => {
    const email = founderDigestEmail({
      newEnquiries: [item("A")],
      dueFollowUps: [],
      unanswered: [],
      metrics: null,
      operations: { counts: OPS_COUNTS, note: { attention: "high", note: "Check the job runs first." } },
    });
    expect(email.text).toContain("Operations (last 24 hours)");
    expect(email.text).toContain(
      [
        "Job runs: 6",
        "Failed job runs: 1",
        "Scheduled jobs that did not run: 0",
        "Emails failed: 0",
        "Email budget reached: 0",
        "Emails sent today: 4",
        "Failed webhooks: 0",
        "AI calls: 3",
        "AI calls failed: 0",
        "AI calls rate limited: 1",
      ].join("\n"),
    );
    expect(email.text).toContain("Suggested focus (AI): Check the job runs first.");
    expect(email.html).toContain("Suggested focus (AI): Check the job runs first.");
  });

  it("omits the suggested focus when there is no note, and the section when there are no counts", () => {
    const withoutNote = founderDigestEmail({
      newEnquiries: [item("A")],
      dueFollowUps: [],
      unanswered: [],
      metrics: null,
      operations: { counts: OPS_COUNTS, note: null },
    });
    expect(withoutNote.text).toContain("Operations (last 24 hours)");
    expect(withoutNote.text).not.toContain("Suggested focus");

    const withoutCounts = founderDigestEmail({ newEnquiries: [item("A")], dueFollowUps: [], unanswered: [], metrics: null });
    expect(withoutCounts.text).not.toContain("Operations (last 24 hours)");
  });

  it("escapes the AI note in HTML and keeps it as text in the plain-text part", () => {
    const email = founderDigestEmail({
      newEnquiries: [item("A")],
      dueFollowUps: [],
      unanswered: [],
      metrics: null,
      operations: { counts: OPS_COUNTS, note: { attention: "low", note: `<img src=x onerror="alert(1)"> & more` } },
    });
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; more");
    expect(email.text).toContain(`Suggested focus (AI): <img src=x onerror="alert(1)"> & more`);
  });
});

describe("every email", () => {
  it("has a plain-text part, a footer with the app URL, no images and no tracking pixels", () => {
    const emails = [
      enquiryAutoReplyEmail({ fullName: "Asha Rao" }),
      welcomeEmail({ firstName: null, clinicName: "Smile Clinic" }),
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
