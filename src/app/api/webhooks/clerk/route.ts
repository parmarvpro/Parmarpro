import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextRequest } from "next/server";

import { isConfigured, supabaseSecretEnv } from "@/lib/env";
import { reportError } from "@/lib/observability/report";
import { errorResponse, jsonResponse, readTextBody } from "@/server/http";
import { webhookStore } from "@/server/privileged/webhooks";
import { archiveClinicFromClerk, deactivateMembershipFromClerk, reconcileInvitedMembership } from "@/server/privileged/membership";
import { sha256Hex } from "@/server/webhooks/hash";

/**
 * Clerk webhook (Svix-signed). Lifecycle events can only remove access or
 * archive; joining is confirmed again through the Clerk Backend API.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await readTextBody(request, 256 * 1024);
    let event;
    try {
      event = await verifyWebhook(new NextRequest(request.url, { method: "POST", headers: request.headers, body: rawBody }));
    } catch {
      reportError(new Error("clerk_webhook_invalid_signature"), { area: "webhook.clerk" });
      return jsonResponse({ outcome: "invalid_signature" }, 400);
    }

    // Signature first. Without the database nothing can be recorded, so answer 503 and let Clerk retry later.
    if (!isConfigured(supabaseSecretEnv)) return jsonResponse({ outcome: "not_connected" }, 503);

    const eventId = request.headers.get("svix-id") ?? "";
    const store = webhookStore("clerk");
    const state = await store.begin({ eventId, eventType: event.type, payloadSha256: sha256Hex(rawBody) });
    if (state === "duplicate") return jsonResponse({ outcome: "duplicate" });

    switch (event.type) {
      case "organizationMembership.deleted": {
        const orgId = event.data.organization.id;
        const userId = event.data.public_user_data?.user_id;
        if (orgId && userId) await deactivateMembershipFromClerk(orgId, userId);
        break;
      }
      case "organizationMembership.created": {
        const orgId = event.data.organization.id;
        const userId = event.data.public_user_data?.user_id;
        if (orgId && userId && event.data.role !== "org:admin") await reconcileInvitedMembership({ userId, orgId });
        break;
      }
      case "organization.deleted": {
        if (event.data.id) await archiveClinicFromClerk(event.data.id);
        break;
      }
      default:
        await store.finish({ eventId, status: "ignored", error: "unhandled_event_type" });
        return jsonResponse({ outcome: "ignored" });
    }
    await store.finish({ eventId, status: "processed" });
    return jsonResponse({ outcome: "processed" });
  } catch (error) {
    return errorResponse(error, "webhook.clerk");
  }
}
