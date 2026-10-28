import "server-only";

import { escapeLike, normalizePhone } from "@/lib/validation/common";

export const PAGE_SIZE = 25;

export function pageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}

/**
 * Builds a safe search: phone-like input searches the phone column, anything
 * else searches the name column. Values are passed as single filter
 * parameters (never interpolated into a PostgREST `or=` expression) and LIKE
 * wildcards are escaped.
 */
export function searchFilter(term: string): { column: "phone_e164" | "full_name"; pattern: string } {
  const digits = term.replace(/[\s()+-]/g, "");
  if (/^\d{4,15}$/.test(digits)) {
    const normalized = normalizePhone(term);
    const value = normalized ?? digits;
    return { column: "phone_e164", pattern: `%${escapeLike(value.replace(/^\+/, ""))}%` };
  }
  return { column: "full_name", pattern: `%${escapeLike(term)}%` };
}

export function memberLabel(member: { display_name: string | null; role: string } | null | undefined): string {
  if (!member) return "Unassigned";
  return member.display_name ?? `Team member (${member.role})`;
}
