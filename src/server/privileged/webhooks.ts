import "server-only";

import { privilegedDb } from "@/server/privileged/client";

export type WebhookStore = {
  /** Records receipt. Returns "new", "duplicate" (already processed or ignored) or "retry" (seen but not finished). */
  begin: (params: { eventId: string; eventType: string; payloadSha256: string }) => Promise<"new" | "duplicate" | "retry">;
  finish: (params: { eventId: string; status: "processed" | "ignored" | "failed"; error?: string }) => Promise<void>;
};

/** Receipt log for Clerk webhooks. Stores identifiers and status only, never the payload. */
export function webhookStore(provider: "clerk"): WebhookStore {
  return {
    async begin({ eventId, eventType, payloadSha256 }) {
      const db = privilegedDb();
      const { error } = await db
        .from("webhook_events")
        .insert({ provider, event_id: eventId, event_type: eventType.slice(0, 100), payload_sha256: payloadSha256 });
      if (!error) return "new";
      if (error.code !== "23505") throw error;
      const { data, error: readError } = await db
        .from("webhook_events")
        .select("status")
        .eq("provider", provider)
        .eq("event_id", eventId)
        .single();
      if (readError) throw readError;
      return data.status === "processed" || data.status === "ignored" ? "duplicate" : "retry";
    },
    async finish({ eventId, status, error }) {
      const { error: updateError } = await privilegedDb()
        .from("webhook_events")
        .update({ status, error: error?.slice(0, 500) ?? null, processed_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("event_id", eventId);
      if (updateError) throw updateError;
    },
  };
}
