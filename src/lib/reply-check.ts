/**
 * Checks a drafted WhatsApp reply before staff see it. Pure, so the server and the tests share it.
 *
 * A draft that fails is never shown: the caller falls back to the standard message. Staff still
 * read, edit and send every reply themselves. The rules stop what a clinic should not promise in
 * writing (prices, offers, guarantees, medical claims) and what must never reach an enquirer from
 * a model (links, email addresses, phone numbers).
 */

export const REPLY_MAX_CHARS = 600;

/** Ten digits is a phone number. Digits separated by spaces, dashes or brackets count together. */
const PHONE_DIGITS = 10;
const DIGIT_RUN = /\+?\d[\d\s().-]*\d/g;

export type ReplyCheck = { ok: true; text: string } | { ok: false; reason: string };

/**
 * Each rule is matched against the lower-case draft, with the clinic's own name left out. Words are
 * whole words where a longer word would be a false alarm (for example "secure" is not "cure").
 */
const RULES: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /₹|\binr\b|\brs(?=[.\s\d])/, reason: "The draft mentions a price or a currency." },
  { pattern: /\d\s*(?:%|percent\b)/, reason: "The draft mentions a percentage." },
  { pattern: /\b(?:discounts?|discounted|offers?|free of cost)\b/, reason: "The draft mentions a discount or an offer." },
  { pattern: /\bguarantee(?:d|s)?\b/, reason: "The draft makes a guarantee." },
  { pattern: /\b(?:cured?|painless)\b|\bdiagnos\w*|\bprescri\w*/, reason: "The draft makes a medical claim." },
  { pattern: /\b(?:antibiotics?|painkillers?|medicines?|tablets?)\b/, reason: "The draft names a medicine." },
  { pattern: /https?:\/\/|\bwww\./, reason: "The draft contains a link." },
  { pattern: /[^\s@]+@[^\s@]+\.[^\s@.]+/, reason: "The draft contains an email address." },
];

/**
 * The draft, trimmed, with the clinic name at its end when the draft does not already contain it.
 * Refused when it is empty, when it breaks a rule, or when the result is longer than REPLY_MAX_CHARS.
 */
export function checkReplyDraft(text: string, clinicName: string): ReplyCheck {
  const body = text.trim();
  if (body === "") return { ok: false, reason: "The draft is empty." };

  const name = clinicName.trim();
  const lower = body.toLowerCase();
  // The clinic's own name is left out of the scan, so a name that contains a flagged word is not refused.
  const scanned = name === "" ? lower : lower.split(name.toLowerCase()).join(" ");

  for (const rule of RULES) {
    if (rule.pattern.test(scanned)) return { ok: false, reason: rule.reason };
  }
  if (hasPhoneNumber(scanned)) return { ok: false, reason: "The draft contains a phone number." };

  const signed = name === "" || lower.includes(name.toLowerCase()) ? body : `${body}\n\n${name}`;
  if (Array.from(signed).length > REPLY_MAX_CHARS) {
    return { ok: false, reason: `The draft is longer than ${REPLY_MAX_CHARS} characters.` };
  }
  return { ok: true, text: signed };
}

function hasPhoneNumber(text: string): boolean {
  for (const run of text.match(DIGIT_RUN) ?? []) {
    if (run.replace(/\D/g, "").length >= PHONE_DIGITS) return true;
  }
  return false;
}
