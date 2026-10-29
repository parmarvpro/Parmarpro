import "server-only";

import { readSignedLink } from "@/server/signed-links";

/**
 * What a preferences token authorises. Pages and actions both call this, so the
 * purpose is decided the same way everywhere. The token is the only authority:
 * no hidden form field decides which purpose applies.
 */
export type PreferenceLink = { kind: "digest"; memberId: string } | { kind: "patient"; appointmentId: string };

export function readPreferenceLink(token: string | undefined): PreferenceLink | null {
  const digest = readSignedLink(token, "digest_unsubscribe");
  if (digest) return { kind: "digest", memberId: digest.subject };
  const patient = readSignedLink(token, "patient_email_opt_out");
  if (patient) return { kind: "patient", appointmentId: patient.subject };
  return null;
}

/** True when the token is a valid enquiry action link for this enquiry id. */
export function isEnquiryLinkFor(token: string | undefined, enquiryId: string): boolean {
  return readSignedLink(token, "enquiry_action")?.subject === enquiryId;
}
