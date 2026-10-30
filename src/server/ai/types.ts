import type { ZodType } from "zod";

import type { AiLane } from "@/server/ai/models";

/**
 * Types shared by the runner, the transport and the call log. Type-only: there is no
 * runtime code here, so the runner can use these types without importing the transport,
 * which only the lanes may import (see eslint.config.mjs).
 */

export type AiThinkingLevel = "minimal" | "low" | "medium" | "high";

/** Token counts for one call. A count the provider omits is 0. */
export type AiUsage = { inputTokens: number; outputTokens: number; thoughtTokens: number };

/** The statuses ai_settle accepts. */
export type AiCallStatus = "ok" | "failed" | "rate_limited" | "invalid_output";

export type ReserveParams = {
  lane: AiLane;
  model: string;
  feature: string;
  clinicId: string | null;
  estTokens: number;
  clinicDailyCap: number | null;
};

export type GenerateRequest<T> = {
  model: string;
  system: string;
  input: string;
  /** JSON Schema for the output. Bound every string and array in it (maxLength, maxItems). */
  schema: object;
  parse: ZodType<T>;
  thinkingLevel: AiThinkingLevel;
  temperature: number;
};

/**
 * `usage` is null when the provider sent no usage object, so the caller can keep the
 * reservation's estimate instead of recording zero tokens.
 */
export type GenerateResult<T> =
  | { ok: true; value: T; usage: AiUsage | null }
  | { ok: false; reason: "rate_limited"; retryAfterMs: number | null }
  | { ok: false; reason: "invalid_output"; usage: AiUsage | null }
  | { ok: false; reason: "failed" };

export type Transport = {
  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
};
