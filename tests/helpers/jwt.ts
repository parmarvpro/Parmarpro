import { SignJWT } from "jose";

import type { Claims } from "./db";
import { loadTestEnv } from "./test-env";

/** Mints an HS256 token with Clerk-shaped claims for the local PostgREST. */
export async function mintToken(claims: Claims | Record<string, unknown>, options: { expiresIn?: string } = {}): Promise<string> {
  const secret = new TextEncoder().encode(loadTestEnv().jwtSecret);
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? "5m")
    .sign(secret);
}
