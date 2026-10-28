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
  | "entitlement_required"
  | "rate_limited"
  | "internal";

const STATUS: Record<AppErrorCode, number> = {
  unauthenticated: 401,
  no_active_clinic: 403,
  forbidden: 403,
  not_found: 404,
  invalid_input: 422,
  conflict: 409,
  entitlement_required: 402,
  rate_limited: 429,
  internal: 500,
};

const MESSAGE: Record<AppErrorCode, string> = {
  unauthenticated: "Please sign in to continue.",
  no_active_clinic: "Select or create a clinic to continue.",
  forbidden: "You do not have permission to do that.",
  not_found: "We could not find that record.",
  invalid_input: "Some of the information provided is not valid.",
  conflict: "That change conflicts with the current state. Refresh and try again.",
  entitlement_required: "Your clinic's plan is not active. Renew it to make changes.",
  rate_limited: "Too many requests. Please wait a moment and try again.",
  internal: "Something went wrong. Please try again.",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Field-level validation messages, safe to show to the user. */
  readonly fieldErrors?: Record<string, string[]>;

  constructor(code: AppErrorCode, options?: { cause?: unknown; fieldErrors?: Record<string, string[]> }) {
    super(MESSAGE[code], { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.fieldErrors = options?.fieldErrors;
  }

  get publicMessage(): string {
    return MESSAGE[this.code];
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
