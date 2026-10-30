// Google's free-tier terms say not to submit personal or confidential information to the
// free tier. This lane may only receive our own non-personal operational data. Imports are
// allowed only from vetted files (see the no-restricted-imports rules in eslint.config.mjs).
import "server-only";

import { geminiFreeEnv, isConfigured } from "@/lib/env";
import { createAiRunner, type AiRunner } from "@/server/ai/run";
import { createGeminiTransport } from "@/server/ai/transport";
import type { Transport } from "@/server/ai/types";
import { reserveAiCall, settleAiCall } from "@/server/privileged/ai-usage";

let shared: AiRunner | undefined;

/** The transport for the free key, or null when GEMINI_FREE_API_KEY is not configured. */
function freeTransport(): Transport | null {
  if (!isConfigured(geminiFreeEnv)) return null;
  return createGeminiTransport({
    fetch: (input, init) => fetch(input, init),
    apiKey: geminiFreeEnv().GEMINI_FREE_API_KEY,
  });
}

/**
 * Process-wide runner for the free lane, built on first use. Without the key every call
 * returns unavailable, with nothing reserved and nothing sent. This lane has no
 * per-clinic cap.
 */
export function freeLane(): AiRunner {
  shared ??= createAiRunner({
    lane: "free",
    transport: freeTransport(),
    reserve: reserveAiCall,
    settle: settleAiCall,
    clinicDailyCap: null,
  });
  return shared;
}
