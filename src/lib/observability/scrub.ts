/**
 * Removes personal and secret data from Sentry events BEFORE they leave the
 * application (client, server and edge). Pure and unit-tested.
 *
 * Strategy: drop whole categories that can hold personal data (request
 * bodies, cookies, headers, query strings, user, local variables), then
 * pattern-scrub every remaining string.
 */

const PATTERNS: [RegExp, string][] = [
  [/eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g, "[jwt]"],
  [/\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g, "[key]"],
  [/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{8,}\b/g, "[key]"],
  [/\brzp_(?:live|test)_[A-Za-z0-9]{6,}\b/g, "[key]"],
  [/\bwhsec_[A-Za-z0-9+/=_-]{8,}\b/g, "[key]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [token]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/(?:\+|\b)(?:91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g, "[phone]"],
  [/\+\d{8,15}\b/g, "[phone]"],
  [/\b[0-9a-f]{40,}\b/gi, "[hex]"],
  [/Failing row contains \(.*?\)/gs, "Failing row contains ([redacted])"],
];

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function scrubString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

/** Keeps the path (with ids replaced) and drops query string and fragment. */
export function scrubUrl(value: string): string {
  try {
    const url = new URL(value, "https://placeholder.invalid");
    const path = url.pathname.replace(UUID, "[id]");
    return url.origin === "https://placeholder.invalid" ? path : `${url.origin}${path}`;
  } catch {
    return "[url]";
  }
}

function scrubDeep(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[depth]";
  if (typeof value === "string") return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (/pass(word)?|secret|token|authorization|cookie|api[-_]?key|signature|email|phone|name|notes?/i.test(key)) {
        out[key] = "[redacted]";
      } else {
        out[key] = scrubDeep(item, depth + 1);
      }
    }
    return out;
  }
  return value;
}

type EventLike = {
  message?: string;
  request?: { url?: string; data?: unknown; cookies?: unknown; headers?: unknown; query_string?: unknown; env?: unknown };
  user?: unknown;
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: BreadcrumbLike[];
  exception?: { values?: { value?: string; stacktrace?: { frames?: { vars?: unknown }[] } }[] };
  transaction?: string;
};

type BreadcrumbLike = { category?: string; message?: string; data?: Record<string, unknown> };

export function scrubEvent<T extends EventLike>(event: T): T {
  if (event.request) {
    const url = event.request.url ? scrubUrl(event.request.url) : undefined;
    event.request = url ? { url } : {};
  }
  delete event.user;
  if (event.message) event.message = scrubString(event.message);
  if (event.transaction) event.transaction = scrubUrl(event.transaction);
  if (event.extra) event.extra = scrubDeep(event.extra) as Record<string, unknown>;
  if (event.contexts) event.contexts = scrubDeep(event.contexts) as Record<string, unknown>;
  if (event.tags) event.tags = scrubDeep(event.tags) as Record<string, unknown>;
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = scrubString(exception.value);
    for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
  }
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs
      .map((crumb) => scrubBreadcrumb(crumb))
      .filter((crumb): crumb is BreadcrumbLike => crumb !== null);
  }
  return event;
}

export function scrubBreadcrumb<T extends BreadcrumbLike>(crumb: T): T | null {
  // Console output and UI input events are the most likely to carry form values.
  if (crumb.category === "console" || crumb.category === "ui.input") return null;
  if (crumb.message) crumb.message = scrubString(crumb.message);
  if (crumb.data) {
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(crumb.data)) {
      if (key === "url" || key === "from" || key === "to") data[key] = typeof value === "string" ? scrubUrl(value) : value;
      else if (key === "method" || key === "status_code") data[key] = value;
    }
    crumb.data = data;
  }
  return crumb;
}
