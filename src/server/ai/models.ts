/**
 * Gemini models, the chains each lane tries in order, and the token estimate that
 * reservations use. Pure: nothing here reads configuration or the network.
 */

/** Free: the free-tier key, non-personal data only. Paid: the billed key. */
export type AiLane = "free" | "paid";

export const GEMINI_MANAGER_MODEL = "gemini-3.8-flash";
export const GEMINI_WORKER_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_WORKER_FALLBACK_MODEL = "gemini-3.1-flash-lite";

export type AiModelChains = { worker: readonly string[]; manager: readonly string[] };

/** The models each lane tries, in order. The worker does the routine work; the manager takes what it cannot. */
export const AI_MODEL_CHAINS: Record<AiLane, AiModelChains> = {
  free: { worker: [GEMINI_WORKER_MODEL, GEMINI_WORKER_FALLBACK_MODEL], manager: [GEMINI_MANAGER_MODEL] },
  paid: { worker: [GEMINI_WORKER_MODEL], manager: [GEMINI_MANAGER_MODEL] },
};

/** Calls per clinic per IST day on the paid lane, across all models. */
export const AI_CLINIC_DAILY_CAP = 100;

/**
 * Estimated input tokens for a reservation, counted from characters at three per
 * token. Deliberately high, so an underestimate can never overshoot the per-minute
 * token limit.
 */
export function estimateInputTokens(system: string, input: string, schema: object): number {
  return Math.ceil((system.length + input.length + JSON.stringify(schema).length) / 3);
}
