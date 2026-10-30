import "server-only";

import type { AiCallStatus, AiUsage, ReserveParams } from "@/server/ai/types";
import type { Database } from "@/server/db/database.types";
import { privilegedDb } from "@/server/privileged/client";

/**
 * PRIVILEGED AI call log. ai_reserve() counts a call against the limits before it is
 * sent, and ai_settle() records its outcome once. Counts and statuses only: no prompt,
 * input or output text is ever passed here.
 */

type ReserveArgs = Database["public"]["Functions"]["ai_reserve"]["Args"];
type SettleArgs = Database["public"]["Functions"]["ai_settle"]["Args"];

/** The reserved call's id, or null when a limit is reached or the model is disabled. Throws on a database error. */
export async function reserveAiCall(params: ReserveParams): Promise<number | null> {
  // The generated RPC types omit nullability. The SQL takes null for "no clinic" and
  // "no cap", so null is sent explicitly: PostgREST reads a missing key as another call.
  const { data, error } = await privilegedDb().rpc("ai_reserve", {
    p_lane: params.lane,
    p_model: params.model,
    p_feature: params.feature,
    p_clinic_id: params.clinicId as ReserveArgs["p_clinic_id"],
    p_est_tokens: params.estTokens,
    p_clinic_daily_cap: params.clinicDailyCap as ReserveArgs["p_clinic_daily_cap"],
  });
  if (error) throw error;
  return data;
}

/** Records the outcome of a reserved call. Null usage keeps the reservation's estimate on record. Throws on a database error. */
export async function settleAiCall(id: number, status: AiCallStatus, usage: AiUsage | null): Promise<void> {
  // Null is sent explicitly for the same reason as in reserveAiCall.
  const { error } = await privilegedDb().rpc("ai_settle", {
    p_id: id,
    p_status: status,
    p_input_tokens: (usage ? usage.inputTokens : null) as SettleArgs["p_input_tokens"],
    p_output_tokens: (usage ? usage.outputTokens : null) as SettleArgs["p_output_tokens"],
    p_thought_tokens: (usage ? usage.thoughtTokens : null) as SettleArgs["p_thought_tokens"],
  });
  if (error) throw error;
}
