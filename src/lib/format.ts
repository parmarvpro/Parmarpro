const TZ = "Asia/Kolkata";

const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFmt.format(new Date(iso)) : "—";
}

export function formatDateTime(iso: string | null | undefined): string {
  return iso ? dateTimeFmt.format(new Date(iso)) : "—";
}

export function formatTime(iso: string | null | undefined): string {
  return iso ? timeFmt.format(new Date(iso)) : "—";
}

/** Human label for snake_case enum values. */
export function humanize(value: string): string {
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "—";
  const indian = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return indian ? `+91 ${indian[1]} ${indian[2]}` : e164;
}
