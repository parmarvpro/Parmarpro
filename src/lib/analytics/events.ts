import { z } from "zod";

/**
 * Product analytics event schema (see docs/analytics-events.md).
 *
 * Naming: snake_case, object_action, past tense. Properties are restricted to
 * enums, booleans, counts and opaque ids. Strict schemas reject anything else,
 * so personal data (names, phones, emails, notes) can't be attached by mistake.
 */
const leadSource = z.enum([
  "walk_in", "phone_call", "whatsapp", "website", "google", "instagram",
  "facebook", "referral", "practo", "justdial", "other",
]);
const appointmentType = z.enum(["consultation", "follow_up", "procedure", "other"]);
const role = z.enum(["admin", "staff", "viewer"]);
const plan = z.literal("parmarpro_clinic_monthly");

export const ANALYTICS_EVENTS = {
  registration_completed: z.object({}).strict(),
  onboarding_completed: z.object({}).strict(),
  clinic_created: z.object({}).strict(),
  lead_created: z.object({ source: leadSource }).strict(),
  patient_created: z.object({}).strict(),
  appointment_created: z.object({ appointment_type: appointmentType, from_lead: z.boolean() }).strict(),
  task_completed: z.object({}).strict(),
  team_member_invited: z.object({ role }).strict(),
  billing_page_viewed: z.object({}).strict(),
  checkout_initiated: z.object({ plan }).strict(),
  /** Sent only after the server verified the payment with Razorpay. */
  payment_verified: z.object({ plan }).strict(),
  page_viewed: z.object({ route: z.string().regex(/^\/[a-z0-9\-/[\]]*$/).max(80) }).strict(),
} as const;

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;
export type AnalyticsProps<E extends AnalyticsEvent> = z.input<(typeof ANALYTICS_EVENTS)[E]>;

export function validateEvent<E extends AnalyticsEvent>(event: E, props: unknown): AnalyticsProps<E> | null {
  const result = ANALYTICS_EVENTS[event].safeParse(props);
  return result.success ? (result.data as AnalyticsProps<E>) : null;
}

/**
 * Reduces a pathname to a route template so record ids never leave the app:
 * /dashboard/leads/3f2c… -> /dashboard/leads/[id]
 */
export function routeTemplate(pathname: string): string {
  return pathname
    .toLowerCase()
    .split("/")
    .map((segment) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(segment) || /\d/.test(segment) ? "[id]" : segment,
    )
    .join("/")
    .replace(/[^a-z0-9\-/[\]]/g, "")
    .slice(0, 80) || "/";
}
