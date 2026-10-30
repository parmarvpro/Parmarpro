import "server-only";

import { publicEnv } from "@/lib/env";
import { formatIstDate, formatIstDateTime } from "@/lib/ist";
import { OPS_COUNT_KEYS, opsNeedsAttention, type OpsCountKey, type OpsCounts } from "@/lib/ops-counts";
import { formatInr } from "@/lib/plans";
import type { OpsNote } from "@/server/ai/features/ops-note";
import type { EmailContent } from "@/server/email/send";

/**
 * Transactional email templates. Each function returns a subject, a plain-text
 * body and an inline-styled HTML body rendered from the same block list, so the
 * two versions cannot drift apart. Every value interpolated into HTML is escaped.
 * No images and no tracking pixels.
 */

const BRAND = "#1f5bff";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes a value for use in HTML text or a quoted attribute. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

type ListItem = { text: string; href?: string };

type Block =
  | { type: "heading"; text: string }
  | { type: "section"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "fields"; rows: ReadonlyArray<readonly [label: string, value: string]> }
  | { type: "list"; items: ReadonlyArray<ListItem> }
  | { type: "button"; label: string; href: string };

type Doc = {
  subject: string;
  blocks: ReadonlyArray<Block>;
  footerLinks?: ReadonlyArray<{ label: string; href: string }>;
};

function appUrl(path = ""): string {
  return `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}${path}`;
}

/** Collapses whitespace so a value cannot break a subject line. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstWord(value: string): string {
  return oneLine(value).split(" ")[0] ?? "";
}

function greeting(name: string): string {
  return name ? `Hi ${name},` : "Hello,";
}

function orDash(value: string | null | undefined): string {
  return value && value.trim() ? value : "—";
}

function days(count: number): string {
  return count === 1 ? "1 day" : `${count} days`;
}

function assertHttpUrl(href: string): string {
  if (!/^https?:\/\//.test(href)) throw new Error("email links must be absolute http(s) URLs");
  return href;
}

function renderText(doc: Doc): string {
  const sections = doc.blocks.map((block) => {
    switch (block.type) {
      case "heading":
      case "section":
      case "paragraph":
        return block.text;
      case "fields":
        return block.rows.map(([label, value]) => `${label}: ${value}`).join("\n");
      case "list":
        return block.items.map((item) => (item.href ? `- ${item.text}: ${item.href}` : `- ${item.text}`)).join("\n");
      case "button":
        return `${block.label}: ${block.href}`;
    }
  });
  const footer = [`ParmarPro · ${appUrl()}`, ...(doc.footerLinks ?? []).map((link) => `${link.label}: ${link.href}`)];
  return `${[...sections, footer.join("\n")].join("\n\n")}\n`;
}

function renderBlockHtml(block: Block): string {
  switch (block.type) {
    case "heading":
      return `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(block.text)}</h1>`;
    case "section":
      return `<h2 style="margin:24px 0 8px;font-size:15px;line-height:1.4;color:#0f172a;">${escapeHtml(block.text)}</h2>`;
    case "paragraph":
      return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(block.text)}</p>`;
    case "fields": {
      const rows = block.rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:6px 16px 6px 0;width:38%;vertical-align:top;font-size:14px;color:#64748b;">${escapeHtml(label)}</td>` +
            `<td style="padding:6px 0;vertical-align:top;font-size:14px;color:#0f172a;white-space:pre-wrap;">${escapeHtml(value)}</td></tr>`,
        )
        .join("");
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;">${rows}</table>`;
    }
    case "list": {
      const items = block.items
        .map((item) => {
          const link = item.href
            ? ` &middot; <a href="${escapeHtml(assertHttpUrl(item.href))}" style="color:${BRAND};">Open</a>`
            : "";
          return `<li style="margin:0 0 4px;">${escapeHtml(item.text)}${link}</li>`;
        })
        .join("");
      return `<ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.6;color:#334155;">${items}</ul>`;
    }
    case "button":
      return (
        `<p style="margin:24px 0 8px;"><a href="${escapeHtml(assertHttpUrl(block.href))}" ` +
        `style="display:inline-block;padding:12px 20px;border-radius:8px;background:${BRAND};color:#ffffff;` +
        `font-size:15px;font-weight:600;text-decoration:none;">${escapeHtml(block.label)}</a></p>`
      );
  }
}

function renderHtml(doc: Doc): string {
  const body = doc.blocks.map(renderBlockHtml).join("");
  const links = (doc.footerLinks ?? [])
    .map(
      (link) =>
        `<a href="${escapeHtml(assertHttpUrl(link.href))}" style="color:#64748b;text-decoration:underline;">${escapeHtml(link.label)}</a>`,
    )
    .join(" &middot; ");
  return [
    "<!doctype html>",
    '<html lang="en">',
    '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(doc.subject)}</title></head>`,
    '<body style="margin:0;padding:0;background:#f4f6fb;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">',
    '<tr><td align="center">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;">',
    '<tr><td style="padding:28px 28px 12px;">',
    `<p style="margin:0 0 20px;font-size:14px;font-weight:700;color:${BRAND};">ParmarPro</p>`,
    body,
    "</td></tr></table>",
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">',
    '<tr><td style="padding:16px 28px;font-size:12px;line-height:1.6;color:#64748b;">',
    `ParmarPro &middot; ${escapeHtml(appUrl())}`,
    links ? `<br>${links}` : "",
    "</td></tr></table>",
    "</td></tr></table>",
    "</body></html>",
  ].join("");
}

function email(doc: Doc): EmailContent {
  return { subject: oneLine(doc.subject), text: renderText(doc), html: renderHtml(doc) };
}

export function enquiryAlertEmail(input: {
  fullName: string;
  clinicName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  message: string | null;
  createdAt: Date;
  manageUrl: string;
}): EmailContent {
  const clinic = input.clinicName ? ` — ${oneLine(input.clinicName)}` : "";
  return email({
    subject: `New enquiry: ${oneLine(input.fullName)}${clinic}`,
    blocks: [
      { type: "heading", text: "New enquiry" },
      {
        type: "fields",
        rows: [
          ["Name", input.fullName],
          ["Clinic", orDash(input.clinicName)],
          ["Phone", orDash(input.phone)],
          ["Email", orDash(input.email)],
          ["City", orDash(input.city)],
          ["Message", orDash(input.message)],
          ["Received", formatIstDateTime(input.createdAt)],
        ],
      },
      { type: "button", label: "Open enquiry", href: input.manageUrl },
    ],
  });
}

/** Auto-reply to the person who sent an enquiry. Uses only their first name. */
export function enquiryAutoReplyEmail(input: { fullName: string }): EmailContent {
  return email({
    subject: "Thanks for contacting ParmarPro",
    blocks: [
      { type: "paragraph", text: greeting(firstWord(input.fullName)) },
      {
        type: "paragraph",
        text: "Thanks for getting in touch. We have received your enquiry and will reply within one working day.",
      },
    ],
  });
}

export function welcomeEmail(input: { firstName: string | null; clinicName: string; trialEndsAt: Date }): EmailContent {
  return email({
    subject: "Welcome to ParmarPro",
    blocks: [
      { type: "paragraph", text: greeting(oneLine(input.firstName ?? "")) },
      { type: "paragraph", text: `Your clinic, ${input.clinicName}, is set up and ready to use.` },
      { type: "paragraph", text: `Your free trial runs until ${formatIstDate(input.trialEndsAt)}.` },
      { type: "button", label: "Go to your dashboard", href: appUrl("/dashboard") },
    ],
  });
}

export type EntitlementNotice =
  | "trial_reminder"
  | "trial_ending"
  | "trial_ended"
  | "renewal_reminder"
  | "renewal_due"
  | "access_lapsed";

function trialSubject(daysLeft: number): string {
  return daysLeft <= 0 ? "Your ParmarPro trial ends today" : `Your ParmarPro trial ends in ${days(daysLeft)}`;
}

function entitlementCopy(
  notice: EntitlementNotice,
  daysLeft: number,
  clinic: string,
  date: string,
): { subject: string; lead: string } {
  const when = daysLeft <= 0 ? "today" : `on ${date}`;
  switch (notice) {
    case "trial_reminder":
    case "trial_ending":
      return { subject: trialSubject(daysLeft), lead: `The free trial for ${clinic} ends ${when}.` };
    case "trial_ended":
      return { subject: "Your ParmarPro trial has ended", lead: `The free trial for ${clinic} ended on ${date}.` };
    case "renewal_reminder":
      return { subject: `Your ParmarPro plan renews in ${days(daysLeft)}`, lead: `The plan for ${clinic} renews on ${date}.` };
    case "renewal_due":
      return {
        subject:
          daysLeft <= 0
            ? "Renew today to keep editing"
            : `Renew ${daysLeft === 1 ? "tomorrow" : `in ${days(daysLeft)}`} to keep editing`,
        lead: `The plan for ${clinic} renews ${when}.`,
      };
    case "access_lapsed":
      return { subject: "Your ParmarPro plan has lapsed", lead: `The plan for ${clinic} lapsed on ${date}.` };
  }
}

export function entitlementNoticeEmail(input: {
  notice: EntitlementNotice;
  clinicName: string;
  daysLeft: number;
  endsAt: Date;
}): EmailContent {
  const copy = entitlementCopy(input.notice, input.daysLeft, oneLine(input.clinicName), formatIstDate(input.endsAt));
  return email({
    subject: copy.subject,
    blocks: [
      { type: "paragraph", text: copy.lead },
      {
        type: "paragraph",
        text: "If access ends, your records stay readable. Adding and editing resumes once your plan is active.",
      },
      { type: "button", label: "Open billing settings", href: appUrl("/dashboard/settings/billing") },
    ],
  });
}

export function paymentReceiptEmail(input: {
  clinicName: string;
  amountPaise: number;
  paidThrough: Date;
  providerPaymentId: string;
  paidAt: Date;
}): EmailContent {
  return email({
    subject: `Payment received for ${oneLine(input.clinicName)}`,
    blocks: [
      { type: "heading", text: "Payment received" },
      { type: "paragraph", text: `Thank you. We received your payment for ${input.clinicName}.` },
      {
        type: "fields",
        rows: [
          ["Amount paid", formatInr(input.amountPaise)],
          ["Paid on", formatIstDateTime(input.paidAt)],
          ["Paid through", formatIstDate(input.paidThrough)],
          ["Payment reference", input.providerPaymentId],
        ],
      },
      { type: "paragraph", text: "This is a payment confirmation, not a GST tax invoice." },
      { type: "button", label: "Open billing settings", href: appUrl("/dashboard/settings/billing") },
    ],
  });
}

export type StaffCounts = {
  tasksDueToday: number;
  tasksOverdue: number;
  followUpsDueToday: number;
  followUpsOverdue: number;
  appointmentsToday: number;
  unassignedOpenTasks: number;
  unassignedFollowUps: number;
};

/** Counts only: no names of patients, leads or colleagues appear in this email. */
export function staffDigestEmail(input: {
  clinicName: string;
  isManager: boolean;
  counts: StaffCounts;
  unsubscribeUrl: string;
}): EmailContent {
  const c = input.counts;
  const total = c.tasksDueToday + c.tasksOverdue + c.followUpsDueToday + c.followUpsOverdue;
  const rows: Array<readonly [string, string]> = [
    ["Tasks due today", String(c.tasksDueToday)],
    ["Overdue tasks", String(c.tasksOverdue)],
    ["Follow-ups due today", String(c.followUpsDueToday)],
    ["Overdue follow-ups", String(c.followUpsOverdue)],
    ["Appointments today", String(c.appointmentsToday)],
  ];
  if (input.isManager) {
    rows.push(["Unassigned open tasks", String(c.unassignedOpenTasks)], ["Unassigned follow-ups", String(c.unassignedFollowUps)]);
  }
  return email({
    subject: `Today at ${oneLine(input.clinicName)}: ${total} to do${
      c.appointmentsToday > 0 ? `, ${c.appointmentsToday} appointment${c.appointmentsToday === 1 ? "" : "s"}` : ""
    }`,
    blocks: [
      { type: "heading", text: `Today at ${input.clinicName}` },
      { type: "paragraph", text: "These are counts only. Open the dashboard for the details." },
      { type: "fields", rows },
      { type: "button", label: "Open dashboard", href: appUrl("/dashboard") },
    ],
    footerLinks: [{ label: "Stop these emails", href: input.unsubscribeUrl }],
  });
}

export type WeeklySummary = {
  leads_created: number;
  leads_converted: number;
  appointments_in_range: number;
  tasks_completed: number;
  tasks_overdue: number;
  follow_ups_due: number;
  patients_total: number;
};

export function weeklySummaryEmail(input: {
  clinicName: string;
  from: Date;
  to: Date;
  summary: WeeklySummary;
}): EmailContent {
  const s = input.summary;
  // `to` is exclusive, so the last day shown is the instant before it.
  const period = `${formatIstDate(input.from)} to ${formatIstDate(new Date(input.to.getTime() - 1))}`;
  return email({
    subject: `Weekly summary for ${oneLine(input.clinicName)}`,
    blocks: [
      { type: "heading", text: `Your week at ${input.clinicName}` },
      { type: "paragraph", text: `Counts for ${period}. Open the dashboard for the details.` },
      {
        type: "fields",
        rows: [
          ["New leads", String(s.leads_created)],
          ["Leads converted", String(s.leads_converted)],
          ["Appointments", String(s.appointments_in_range)],
          ["Tasks completed", String(s.tasks_completed)],
          ["Overdue tasks now", String(s.tasks_overdue)],
          ["Follow-ups due now", String(s.follow_ups_due)],
          ["Patients on record", String(s.patients_total)],
        ],
      },
      { type: "button", label: "Open dashboard", href: appUrl("/dashboard") },
    ],
  });
}

/** Patient reminder. Carries only the first name, clinic, time and a contact line. */
export function patientReminderEmail(input: {
  firstName: string;
  clinicName: string;
  startsAt: Date;
  optOutUrl: string;
}): EmailContent {
  return email({
    subject: `Reminder: your appointment at ${oneLine(input.clinicName)}`,
    blocks: [
      { type: "paragraph", text: greeting(oneLine(input.firstName)) },
      {
        type: "paragraph",
        text: `This is a reminder of your appointment at ${input.clinicName} on ${formatIstDateTime(input.startsAt)}.`,
      },
      { type: "paragraph", text: "Please contact the clinic if you need to change it." },
    ],
    footerLinks: [{ label: "Stop appointment emails", href: input.optOutUrl }],
  });
}

export type DigestItem = {
  fullName: string;
  clinicName: string | null;
  city: string | null;
  createdAt: Date;
  url: string;
};

export type FounderMetrics = {
  clinics_created: number;
  trials_active: number;
  paid_active: number;
  payments_captured: number;
  revenue_paise: number;
  enquiries: number;
};

function digestItemText(item: DigestItem): string {
  const parts = [item.fullName];
  if (item.clinicName) parts.push(item.clinicName);
  if (item.city) parts.push(item.city);
  parts.push(formatIstDateTime(item.createdAt));
  return parts.join(" · ");
}

/** Plain-words labels for the operations counts, keyed by count. Every key has one. */
const OPS_LABELS: Record<OpsCountKey, string> = {
  job_runs: "Job runs",
  job_runs_failed: "Failed job runs",
  jobs_not_run: "Scheduled jobs that did not run",
  emails_failed: "Emails failed",
  email_budget_hits: "Email budget reached",
  emails_sent_today: "Emails sent today",
  webhooks_failed: "Failed webhooks",
  orders_unpaid_over_1h: "Unpaid orders over 1 hour",
  ai_calls: "AI calls",
  ai_calls_failed: "AI calls failed",
  ai_calls_rate_limited: "AI calls rate limited",
};

/**
 * The operations section of the digest. The note is model output: it is shown as plain
 * text, escaped like every other value.
 */
export type OperationsSummary = { counts: OpsCounts; note: OpsNote | null };

/** The digest's subject: the new-enquiry count, and a warning when operations need attention. */
function digestSubject(newEnquiries: number, operations: OperationsSummary | null): string {
  const enquiries = `${newEnquiries} new ${newEnquiries === 1 ? "enquiry" : "enquiries"}`;
  const warning = operations !== null && opsNeedsAttention(operations.counts) ? ", operations need attention" : "";
  return `ParmarPro daily: ${enquiries}${warning}`;
}

export function founderDigestEmail(input: {
  newEnquiries: ReadonlyArray<DigestItem>;
  dueFollowUps: ReadonlyArray<DigestItem>;
  unanswered: ReadonlyArray<DigestItem>;
  metrics: FounderMetrics | null;
  /** Null when the counts could not be read, or were not requested. */
  operations?: OperationsSummary | null;
}): EmailContent {
  const blocks: Block[] = [{ type: "heading", text: "Daily digest" }];

  const sections: Array<[string, ReadonlyArray<DigestItem>]> = [
    ["New enquiries", input.newEnquiries],
    ["Follow-ups due", input.dueFollowUps],
    ["Unanswered", input.unanswered],
  ];
  for (const [title, items] of sections) {
    if (items.length === 0) continue;
    blocks.push(
      { type: "section", text: `${title} (${items.length})` },
      { type: "list", items: items.map((item) => ({ text: digestItemText(item), href: item.url })) },
    );
  }

  if (input.operations) {
    const { counts, note } = input.operations;
    blocks.push(
      { type: "section", text: "Operations (last 24 hours)" },
      { type: "fields", rows: OPS_COUNT_KEYS.map((key) => [OPS_LABELS[key], String(counts[key])] as const) },
    );
    if (note) blocks.push({ type: "paragraph", text: `Suggested focus (AI): ${oneLine(note.note)}` });
  }

  if (input.metrics) {
    const m = input.metrics;
    blocks.push(
      { type: "section", text: "Platform metrics" },
      {
        type: "fields",
        rows: [
          ["New clinics", String(m.clinics_created)],
          ["Trials active", String(m.trials_active)],
          ["Paid clinics active", String(m.paid_active)],
          ["Payments captured", String(m.payments_captured)],
          ["Revenue", formatInr(m.revenue_paise)],
          ["Enquiries", String(m.enquiries)],
        ],
      },
    );
  }

  if (blocks.length === 1) {
    blocks.push({ type: "paragraph", text: "Nothing needs attention today." });
  }

  return email({
    subject: digestSubject(input.newEnquiries.length, input.operations ?? null),
    blocks,
  });
}
