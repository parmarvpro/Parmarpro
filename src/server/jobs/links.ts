import "server-only";

import { isConfigured, linkSigningEnv, publicEnv } from "@/lib/env";
import { signedLink } from "@/server/signed-links";

/**
 * Default links for the scheduled jobs' emails. Each job takes its link builder
 * as a dependency, and these are the production builders.
 */

const DIGEST_LINK_DAYS = 60;
const OPT_OUT_LINK_DAYS = 14;
const ENQUIRY_LINK_DAYS = 30;

/** App base URL without a trailing slash. */
function appBaseUrl(): string {
  return publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

/** "Stop these emails" link in the staff digest. Without link signing it points at the automation settings. */
export function digestUnsubscribeUrl(memberId: string): string {
  if (isConfigured(linkSigningEnv)) {
    return signedLink("/email/preferences", "digest_unsubscribe", memberId, DIGEST_LINK_DAYS);
  }
  return `${appBaseUrl()}/dashboard/settings/automations`;
}

/**
 * Link to one enquiry in the founder digest. Without link signing the digest
 * still goes out, pointing at the dashboard.
 */
export function enquiryManageUrl(enquiryId: string): string {
  if (isConfigured(linkSigningEnv)) {
    return signedLink(`/ops/enquiry/${enquiryId}`, "enquiry_action", enquiryId, ENQUIRY_LINK_DAYS);
  }
  return `${appBaseUrl()}/dashboard`;
}

/**
 * Opt-out link builder for patient reminders, or null when links cannot be
 * signed. Patients always get an opt-out link, so the caller sends nothing without one.
 */
export function patientOptOutUrlBuilder(): ((appointmentId: string) => string) | null {
  if (!isConfigured(linkSigningEnv)) return null;
  return (appointmentId) => signedLink("/email/preferences", "patient_email_opt_out", appointmentId, OPT_OUT_LINK_DAYS);
}
