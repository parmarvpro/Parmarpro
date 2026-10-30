/**
 * Removes contact details from text before any of it leaves for an AI service. Pure.
 *
 * The text is scanned once, from left to right, and each match becomes a placeholder:
 * "[email]", "[phone]" or "[name]". Nothing is scanned twice, so one replacement can
 * never undo another. The lead's own email, phone and name are matched exactly as well as
 * by pattern, so a spelling the patterns miss is still caught.
 */

export type Contact = { fullName: string; phone: string | null; email: string | null };

type Groups = { email?: string; phone?: string; name?: string };

const PHONE_MIN_DIGITS = 10;
const NAME_MIN_LETTERS = 3;
const LETTER = String.raw`\p{L}\p{M}`;
const SEPARATOR = String.raw`[^${LETTER}\p{N}]{0,3}`;

/** An address: a run of non-space characters, an @, and a domain with a dot. */
const EMAIL = String.raw`[^\s@]+@[^\s@]+\.[^\s@.]+`;
/** Digits with spaces, brackets, dots, dashes or slashes between them, optionally led by + or (. */
const PHONE = String.raw`\+?\(?\d[\d\s().\-/]*\d`;

export function redactContact(text: string, contact: Contact): string {
  const branches = [
    `(?<email>${[ownEmail(contact.email), EMAIL].filter(isText).join("|")})`,
    `(?<phone>${[ownPhone(contact.phone), PHONE].filter(isText).join("|")})`,
  ];
  const names = namePattern(contact.fullName);
  if (names !== null) branches.push(`(?<name>${names})`);

  const pattern = new RegExp(branches.join("|"), "giu");
  return text.replace(pattern, (match: string, ...rest: unknown[]) => {
    // With named groups, the last argument is the groups object.
    const groups = rest[rest.length - 1] as Groups;
    if (groups.email !== undefined) return "[email]";
    if (groups.phone !== undefined) return digitCount(match) >= PHONE_MIN_DIGITS ? "[phone]" : match;
    return "[name]";
  });
}

/** The lead's own address as written. An empty or blank value must not become an empty alternative, which would match everywhere. */
function ownEmail(email: string | null): string | null {
  const trimmed = (email ?? "").trim();
  return trimmed === "" ? null : escapeRegex(trimmed);
}

/** The lead's own number, from its last ten digits, with up to three separators between any two digits. */
function ownPhone(phone: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < PHONE_MIN_DIGITS) return null;
  return digits.slice(-PHONE_MIN_DIGITS).split("").join(SEPARATOR);
}

/** Each name token of three or more letters, as a whole word, in any case. Null when there is none. */
function namePattern(fullName: string): string | null {
  const tokens = new Set((fullName.match(new RegExp(`[${LETTER}]+`, "gu")) ?? []).filter((token) => token.length >= NAME_MIN_LETTERS));
  if (tokens.size === 0) return null;
  const alternatives = [...tokens].map(escapeRegex).join("|");
  return `(?<![${LETTER}\\p{N}])(?:${alternatives})(?![${LETTER}\\p{N}])`;
}

function escapeRegex(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
}

function digitCount(text: string): number {
  return text.replace(/\D/g, "").length;
}

function isText(value: string | null): value is string {
  return value !== null;
}
