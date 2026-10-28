import "server-only";

import { createHash } from "node:crypto";

/** Pseudonymous analytics identifier derived from the Clerk user id. */
export function analyticsIdFor(userId: string): string {
  return createHash("sha256").update(`parmarpro-analytics:${userId}`).digest("hex").slice(0, 32);
}
