/**
 * The line the public enquiry form adds to a lead's notes. Pure, so the server can read
 * it without importing the privileged client that writes it (src/server/privileged/enquiry.ts).
 */
export const CONSENT_NOTE = "Website enquiry form: the enquirer agreed to be contacted about this enquiry.";

/** A lead's enquiry text: its notes without the consent line. Empty when nothing else is left. */
export function enquiryTextFromNotes(notes: string | null): string {
  return (notes ?? "").split(CONSENT_NOTE).join("").trim();
}
