import "server-only";

import { unstable_rethrow } from "next/navigation";

import { reportError } from "@/lib/observability/report";
import { AppError, isAppError, type AppErrorCode } from "@/server/auth/errors";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AppErrorCode; message: string; fieldErrors?: Record<string, string[]> };

/**
 * Runs a Server Action body and converts failures into a serializable result
 * with a safe message. Unexpected errors are reported (scrubbed) and surfaced
 * as a generic "internal" error. Next.js control-flow errors (redirect,
 * notFound) are rethrown.
 */
export async function runAction<T>(area: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    unstable_rethrow(error);
    const appError = isAppError(error) ? error : new AppError("internal", { cause: error });
    if (appError.code === "internal") {
      reportError(appError.cause ?? error, { area, code: appError.code });
    }
    return {
      ok: false,
      code: appError.code,
      message: appError.publicMessage,
      ...(appError.fieldErrors ? { fieldErrors: appError.fieldErrors } : {}),
    };
  }
}
