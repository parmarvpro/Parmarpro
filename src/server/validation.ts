import "server-only";

import { z } from "zod";

import { AppError } from "@/server/auth/errors";

/** Validates untrusted input; throws AppError("invalid_input") with field messages. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const { fieldErrors } = z.flattenError(result.error);
    throw new AppError("invalid_input", { fieldErrors: fieldErrors as Record<string, string[]> });
  }
  return result.data;
}
