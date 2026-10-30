import "server-only";

import { geminiPaidEnv, isConfigured } from "@/lib/env";

/**
 * Whether the paid Gemini key is configured. Only the check is made: the key value is never read
 * here. Pages use it to show or hide AI actions, and the sorters use it before a call is reserved.
 */
export function paidLaneConfigured(): boolean {
  return isConfigured(geminiPaidEnv);
}
