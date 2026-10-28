import { AppError } from "@/server/auth/errors";

type DbErrorLike = { code?: string; message?: string; details?: string | null } | null | undefined;

/**
 * Maps PostgreSQL / PostgREST errors to safe application errors. The raw
 * error is kept as `cause` for scrubbed server-side reporting only.
 */
export function mapDbError(error: DbErrorLike): AppError {
  const code = error?.code ?? "";
  switch (code) {
    case "42501": // insufficient_privilege, including RLS violations
      return new AppError("forbidden", { cause: error });
    case "P0002": // no_data_found raised by RPCs
    case "PGRST116": // .single() found no row
      return new AppError("not_found", { cause: error });
    case "22P02": // invalid_text_representation (for example a malformed uuid)
    case "23503": // foreign_key_violation: the referenced record isn't in this clinic
    case "23514": // check_violation, including invalid state transitions
    case "23502": // not_null_violation
    case "22001": // string_data_right_truncation
    case "22023": // invalid_parameter_value
      return new AppError("invalid_input", { cause: error });
    case "23505":
      return new AppError("conflict", { cause: error });
    case "54000":
      return new AppError("rate_limited", { cause: error });
    default:
      return new AppError("internal", { cause: error });
  }
}

/** Throws a mapped AppError when a Supabase response carries an error. */
export function throwIfDbError(error: DbErrorLike): void {
  if (error) throw mapDbError(error);
}
