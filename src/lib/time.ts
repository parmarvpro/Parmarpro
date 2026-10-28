const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start and end (exclusive) of the IST calendar day containing `at`, as ISO strings. */
export function istDayBounds(at: Date = new Date()): { start: string; end: string } {
  const shifted = at.getTime() + IST_OFFSET_MS;
  const startShifted = Math.floor(shifted / DAY_MS) * DAY_MS;
  const start = startShifted - IST_OFFSET_MS;
  return { start: new Date(start).toISOString(), end: new Date(start + DAY_MS).toISOString() };
}

export function daysAgo(days: number, from: Date = new Date()): string {
  return new Date(from.getTime() - days * DAY_MS).toISOString();
}

/** Start of the current IST calendar month. */
export function istMonthStart(at: Date = new Date()): string {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  const start = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - IST_OFFSET_MS;
  return new Date(start).toISOString();
}
