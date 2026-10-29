/**
 * India Standard Time helpers. Pure (no server-only), so they can be used by
 * server code, tests and shared formatting alike.
 *
 * India has no daylight saving time, so IST is a fixed UTC+05:30 offset.
 */

export const IST = "Asia/Kolkata";

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: IST,
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** 00:00 IST of the IST calendar day that contains `date`, as an absolute instant. */
export function istDayStart(date: Date): Date {
  const shifted = date.getTime() + IST_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - IST_OFFSET_MS);
}

/** 00:00 IST on the Monday of the IST week that contains `date`. */
export function istWeekStart(date: Date): Date {
  const dayStart = istDayStart(date);
  // Day number since 1970-01-01 (a Thursday) in IST; Monday is 0.
  const dayNumber = Math.floor((dayStart.getTime() + IST_OFFSET_MS) / DAY_MS);
  const weekday = (dayNumber + 3) % 7;
  return new Date(dayStart.getTime() - weekday * DAY_MS);
}

/** "YYYY-MM-DD" of the IST calendar day that contains `date`. */
export function istDateKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Date and time in IST, for example "Fri, 30 Oct 2026, 10:30 am". */
export function formatIstDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

/** Date only in IST, for example "30 Oct 2026". */
export function formatIstDate(date: Date): string {
  return dateFormat.format(date);
}
