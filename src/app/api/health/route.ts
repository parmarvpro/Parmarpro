import { publicEnv } from "@/lib/env";
import { jsonResponse } from "@/server/http";

/**
 * Liveness check for uptime monitors. It answers without a database call and
 * without any secret, so a failing monitor means the application itself is not
 * serving. Database health is not reported here. The body carries only the
 * environment name.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return jsonResponse({ status: "ok", env: publicEnv.NEXT_PUBLIC_APP_ENV });
}

export function HEAD(): Response {
  return new Response(null, { status: 200, headers: { "cache-control": "no-store" } });
}
