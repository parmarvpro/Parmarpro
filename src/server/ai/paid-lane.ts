// The paid lane uses the billed Gemini key, which is held in a separate Google Cloud project.
// Imports are allowed only from vetted feature files (see the no-restricted-imports rules in
// eslint.config.mjs).
import "server-only";

import { geminiPaidEnv, isConfigured } from "@/lib/env";
import { AI_CLINIC_DAILY_CAP } from "@/server/ai/models";
import { createAiRunner, type AiRunner } from "@/server/ai/run";
import { createGeminiTransport } from "@/server/ai/transport";
import type { Transport } from "@/server/ai/types";
import { reserveAiCall, settleAiCall } from "@/server/privileged/ai-usage";

let shared: AiRunner | undefined;

/** The transport for the paid key, or null when GEMINI_PAID_API_KEY is not configured. */
function paidTransport(): Transport | null {
  if (!isConfigured(geminiPaidEnv)) return null;
  return createGeminiTransport({
    fetch: (input, init) => fetch(input, init),
    apiKey: geminiPaidEnv().GEMINI_PAID_API_KEY,
  });
}

/**
 * Process-wide runner for the paid lane, built on first use. Without the key every call
 * returns unavailable, with nothing reserved and nothing sent. Each clinic is capped at
 * AI_CLINIC_DAILY_CAP calls per IST day.
 */
export function paidLane(): AiRunner {
  shared ??= createAiRunner({
    lane: "paid",
    transport: paidTransport(),
    reserve: reserveAiCall,
    settle: settleAiCall,
    clinicDailyCap: AI_CLINIC_DAILY_CAP,
  });
  return shared;
}
