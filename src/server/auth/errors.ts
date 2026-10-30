/**
 * Typed application errors. Each maps to one HTTP status and one safe,
 * user-facing message. Internal details never reach the client.
 */

export type AppErrorCode =
  | "unauthenticated"
  | "no_active_clinic"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "conflict"
  | "rate_limited"
  | "ai_disabled"
  | "ai_not_configured"
  | "ai_unavailable"
  | "nothing_to_sort"
  | "not_configured"
  | "internal";

const STATUS: Record<AppErrorCode, number> = {
  unauthenticated: 401,
  no_active_clinic: 403,
  forbidden: 403,
  not_found: 404,
  invalid_input: 422,
  conflict: 409,
  rate_limited: 429,
  ai_disabled: 403,
  ai_not_configured: 503,
  ai_unavailable: 503,
  nothing_to_sort: 422,
  not_configured: 503,
  internal: 500,
};

const MESSAGE: Record<AppErrorCode, string> = {
  unauthenticated: "Please sign in to continue.",
  no_active_clinic: "Select or create a clinic to continue.",
  forbidden: "You do not have permission to do that.",
  not_found: "We could not find that record.",
  invalid_input: "Some of the information provided is not valid.",
  conflict: "That change conflicts with the current state. Refresh and try again.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  ai_disabled: "AI help with enquiries is off. An owner or administrator can turn it on in Automations.",
  ai_not_configured: "AI sorting is not available yet.",
  ai_unavailable: "AI is busy, try again later.",
  nothing_to_sort: "This lead has no enquiry text to sort.",
  not_configured: "This feature is not connected yet. Please try again later.",
  internal: "Something went wrong. Please try again.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Field-level validation messages, safe to show to the user. */
  readonly fieldErrors?: Record<string, string[]>;

  constructor(code: AppErrorCode, options?: { cause?: unknown; fieldErrors?: Record<string, string[]> }) {
    // Only the cause's name and code are kept. Raw database or provider errors
    // can carry personal data ("Failing row contains (...)", invited emails)
    // and an uncaught error's cause is printed in server logs.
    super(MESSAGE[code], options?.cause === undefined ? undefined : { cause: summarizeCause(options.cause) });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = options?.fieldErrors;
  }

  get publicMessage(): string {
    return MESSAGE[this.code];
  }
}

export function summarizeCause(cause: unknown): { name: string; code: string } {
  const raw = (typeof cause === "object" && cause !== null ? cause : {}) as { name?: unknown; code?: unknown; status?: unknown };
  const name = typeof raw.name === "string" ? raw.name : typeof cause === "object" && cause !== null ? "Error" : typeof cause;
  const code = typeof raw.code === "string" || typeof raw.code === "number" ? String(raw.code) : typeof raw.status === "number" ? String(raw.status) : "unknown";
  return { name, code };
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
