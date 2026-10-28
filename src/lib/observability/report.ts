import * as Sentry from "@sentry/nextjs";

type ErrorLike = { code?: unknown; name?: unknown };

/**
 * Converts an arbitrary error into one that is safe to send to monitoring:
 * keeps the error class/name and a machine-readable code, drops messages and
 * details (PostgreSQL "Failing row contains (...)" details can include
 * patient data).
 */
export function toSafeError(error: unknown): Error {
  const raw = (typeof error === "object" && error !== null ? error : {}) as ErrorLike;
  const name = typeof raw.name === "string" ? raw.name : "Error";
  const code = typeof raw.code === "string" || typeof raw.code === "number" ? String(raw.code) : "unknown";
  const safe = new Error(`${name}:${code}`);
  safe.name = name;
  if (error instanceof Error && error.stack) {
    // Keep frames, replace the first line (which repeats the message).
    safe.stack = `${name}:${code}\n${error.stack.split("\n").slice(1).join("\n")}`;
  }
  return safe;
}

export function reportError(error: unknown, context: { area: string; code?: string }): void {
  const safe = toSafeError(error);
  Sentry.captureException(safe, { tags: { area: context.area, code: context.code ?? "unknown" } });
  // Minimal server log line: no messages, no payloads.
  console.error(`[${context.area}] ${safe.message}`);
}
