import "server-only";

import { reportError } from "@/lib/observability/report";
import { AppError, isAppError } from "@/server/auth/errors";

const JSON_HEADERS = { "content-type": "application/json", "cache-control": "no-store" } as const;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function errorResponse(error: unknown, area: string): Response {
  const appError = isAppError(error) ? error : new AppError("internal", { cause: error });
  if (appError.code === "internal") reportError(appError.cause ?? error, { area, code: appError.code });
  return jsonResponse(
    {
      error: appError.code,
      message: appError.publicMessage,
      ...(appError.fieldErrors ? { fieldErrors: appError.fieldErrors } : {}),
    },
    appError.status,
  );
}

/** Reads a JSON body with a hard size limit (bytes). */
export async function readJsonBody(request: Request, maxBytes = 16 * 1024): Promise<unknown> {
  const text = await readTextBody(request, maxBytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("invalid_input");
  }
}

/** Reads the raw body as text with a hard size limit (needed for signature checks). */
export async function readTextBody(request: Request, maxBytes = 64 * 1024): Promise<string> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new AppError("invalid_input");
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw new AppError("invalid_input");
  return new TextDecoder().decode(buffer);
}
