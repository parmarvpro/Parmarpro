import { z } from "zod";

/**
 * Shared input primitives. Used by forms (client) and re-validated on the
 * server. Server validation is authoritative.
 */

const trimmed = (max: number) => z.string().trim().max(max, `Must be ${max} characters or fewer.`);

export const nameField = trimmed(120).min(1, "Required.");
export const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((value) => (value ? value : null));

/**
 * Normalizes phone numbers to E.164. Accepts Indian 10-digit mobile numbers
 * (optionally prefixed with 0, 91 or +91) and any already-international
 * number starting with "+".
 */
export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[\s()-]/g, "");
  if (compact === "") return null;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  const digits = compact.replace(/^\+/, "");
  const indian = /^(?:0|91)?([6-9]\d{9})$/.exec(digits);
  if (indian) return `+91${indian[1]}`;
  return null;
}

export const optionalPhone = z
  .string()
  .trim()
  .max(24)
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid phone number, e.g. 98xxxxxxxx or +91 98xxxxxxxx." });
      return z.NEVER;
    }
    return normalized;
  });

export const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const lower = value.toLowerCase();
    if (!z.email().safeParse(lower).success) {
      ctx.addIssue({ code: "custom", message: "Enter a valid email address." });
      return z.NEVER;
    }
    return lower;
  });

export const uuidField = z.uuid("Invalid identifier.");
export const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((value) => (value ? value : null));

/**
 * Datetime from an <input type="datetime-local"> in clinic time (IST,
 * UTC+05:30, no DST). Returns an ISO-8601 UTC string.
 */
export function istLocalToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const utcMs = Date.UTC(y, mo - 1, d, h, mi) - (5 * 60 + 30) * 60 * 1000;
  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isoToIstLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(new Date(iso).getTime() + (5 * 60 + 30) * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

export const istDateTime = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const iso = istLocalToIso(value);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time." });
      return z.NEVER;
    }
    return iso;
  });

export const optionalIstDateTime = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const iso = istLocalToIso(value);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time." });
      return z.NEVER;
    }
    return iso;
  });

/** Escapes LIKE/ILIKE wildcards so user search text is matched literally. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const searchTerm = z
  .string()
  .trim()
  .max(80)
  .optional()
  .transform((value) => (value ? value : null));
