import "server-only";

import { founderAlertEnv, isConfigured } from "@/lib/env";
import { istDayStart } from "@/lib/ist";
import { reportError } from "@/lib/observability/report";
import { enquiryAlertEmail, enquiryAutoReplyEmail } from "@/server/email/templates";
import { enquiryManageUrl } from "@/server/jobs/links";
import { autoRepliesSentSince } from "@/server/privileged/email-actions";
import { notifier, type SendOnceParams, type SendOutcome } from "@/server/privileged/notifications";

const AREA = "automations.enquiry";

/** Enquiry auto-replies per IST day. Founder alerts do not count against it. */
export const AUTO_REPLY_DAILY_CAP = 50;

export type EnquiryNotice = {
  id: string;
  fullName: string;
  clinicName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  message: string | null;
};

export type EnquiryNotificationDeps = {
  /** The founder's address, or null when founder alerts are not configured. */
  founderAddress: () => string | null;
  manageUrl: (enquiryId: string) => string;
  autoRepliesSentSince: (since: Date) => Promise<number>;
  sendOnce: (params: SendOnceParams) => Promise<SendOutcome>;
  report: (error: unknown, context: { area: string }) => void;
  now: () => Date;
};

function productionDeps(): EnquiryNotificationDeps {
  return {
    founderAddress: () => (isConfigured(founderAlertEnv) ? founderAlertEnv().FOUNDER_ALERT_EMAIL : null),
    manageUrl: enquiryManageUrl,
    autoRepliesSentSince,
    sendOnce: (params) => notifier().sendOnce(params),
    report: reportError,
    now: () => new Date(),
  };
}

/**
 * Emails for a new enquiry: an alert to the founder, and an auto-reply to the
 * submitter when they gave an email address. Each email is independent and
 * best-effort. Failures are reported under the area and never thrown, so the
 * caller can run this after the response without checking it.
 */
export async function notifyEnquiry(input: EnquiryNotice, deps: EnquiryNotificationDeps = productionDeps()): Promise<void> {
  await settle(deps, () => sendFounderAlert(input, deps));
  await settle(deps, () => sendAutoReply(input, deps));
}

async function settle(deps: EnquiryNotificationDeps, step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch (error) {
    deps.report(error, { area: AREA });
  }
}

async function sendFounderAlert(input: EnquiryNotice, deps: EnquiryNotificationDeps): Promise<void> {
  const to = deps.founderAddress();
  if (to === null) return;
  const now = deps.now();
  await deps.sendOnce({
    kind: "enquiry_alert",
    clinicId: null,
    subjectKey: input.id,
    periodKey: "once",
    to,
    content: enquiryAlertEmail({
      fullName: input.fullName,
      clinicName: input.clinicName,
      phone: input.phone,
      email: input.email,
      city: input.city,
      message: input.message,
      createdAt: now,
      manageUrl: deps.manageUrl(input.id),
    }),
    dryRun: false,
  });
}

async function sendAutoReply(input: EnquiryNotice, deps: EnquiryNotificationDeps): Promise<void> {
  if (!input.email) return;
  const sentToday = await deps.autoRepliesSentSince(istDayStart(deps.now()));
  if (sentToday >= AUTO_REPLY_DAILY_CAP) return;
  await deps.sendOnce({
    kind: "enquiry_auto_reply",
    clinicId: null,
    subjectKey: input.id,
    periodKey: "once",
    to: input.email,
    content: enquiryAutoReplyEmail({ fullName: input.fullName }),
    dryRun: false,
  });
}
