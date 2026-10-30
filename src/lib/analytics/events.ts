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

export const ANALYTICS_EVENTS = {
  registration_completed: z.object({}).strict(),
  onboarding_completed: z.object({}).strict(),
  clinic_created: z.object({}).strict(),
  lead_created: z.object({ source: leadSource }).strict(),
  patient_created: z.object({}).strict(),
  appointment_created: z.object({ appointment_type: appointmentType, from_lead: z.boolean() }).strict(),
  task_completed: z.object({}).strict(),
  team_member_invited: z.object({ role }).strict(),
  page_viewed: z.object({ route: z.string().regex(/^\/[a-z0-9\-/[\]]*$/).max(80) }).strict(),
} as const;

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;
export type AnalyticsProps<E extends AnalyticsEvent> = z.input<(typeof ANALYTICS_EVENTS)[E]>;

export function validateEvent<E extends AnalyticsEvent>(event: E, props: unknown): AnalyticsProps<E> | null {
  // An event name that is not in the allowlist (for example one that was removed) is rejected, never thrown.
  const schema = (ANALYTICS_EVENTS as Record<string, z.ZodType | undefined>)[event];
  if (!schema) return null;
  const result = schema.safeParse(props);
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

const SYSTEM_EVENTS = new Set(["$identify", "$groupidentify", "$opt_in", "$create_alias"]);
const URL_PROPERTY = /^\$(current_url|pathname|host|referrer|referring_domain|search_engine|initial_.*|prev_pageview_.*|session_entry_.*)$/;

type CaptureLike = {
  event: string;
  properties?: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
};

function stripUrlProperties(properties: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!properties) return properties;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (URL_PROPERTY.test(key) || /^utm_|^gclid$|^fbclid$/.test(key)) continue;
    if (key === "$set" || key === "$set_once") {
      out[key] = stripUrlProperties(value as Record<string, unknown>);
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Last line of defence before an event leaves the browser (PostHog
 * `before_send`): drops events outside the schema and removes URL,
 * referrer and campaign properties, which could carry search terms.
 */
export function sanitizeCapture<T extends CaptureLike>(capture: T | null): T | null {
  if (!capture) return null;
  if (!(capture.event in ANALYTICS_EVENTS) && !SYSTEM_EVENTS.has(capture.event)) return null;
  return {
    ...capture,
    properties: stripUrlProperties(capture.properties),
    $set: stripUrlProperties(capture.$set),
    $set_once: stripUrlProperties(capture.$set_once),
  };
}
