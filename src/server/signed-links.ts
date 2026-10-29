import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { isConfigured, linkSigningEnv, publicEnv } from "@/lib/env";

/**
 * Signed links for email actions (enquiry actions, digest unsubscribe, patient
 * opt-out). A token carries its own subject and expiry and is authenticated with
 * HMAC-SHA256, so no database lookup is needed to accept it.
 *
 * Token: base64url(subject) "." expiresAtMs "." base64url(HMAC(secret, purpose "\n" subject "\n" expiresAtMs))
 */

export type LinkPurpose = "enquiry_action" | "digest_unsubscribe" | "patient_email_opt_out";

const DAY_MS = 24 * 60 * 60 * 1000;
// Subjects are record ids. The cap keeps every signed token under MAX_TOKEN_LENGTH, so verify never rejects a token it issued.
const MAX_SUBJECT_LENGTH = 200;
const MAX_TOKEN_LENGTH = 512;

function mac(secret: string, purpose: LinkPurpose, subject: string, expiresAtMs: number): Buffer {
  return createHmac("sha256", secret).update(`${purpose}\n${subject}\n${expiresAtMs}`, "utf8").digest();
}

/** Decodes base64url only when re-encoding gives back the same text, which rejects non-canonical input. */
function decodeBase64url(text: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const bytes = Buffer.from(text, "base64url");
  return bytes.toString("base64url") === text ? bytes : null;
}

export function signToken(secret: string, purpose: LinkPurpose, subject: string, expiresAtMs: number): string {
  if (subject.length === 0 || subject.length > MAX_SUBJECT_LENGTH || /[\r\n]/.test(subject)) {
    throw new Error("signed link subject must be one non-empty line of at most 200 characters");
  }
  if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs < 0) throw new Error("signed link expiry must be a timestamp");
  const encodedSubject = Buffer.from(subject, "utf8").toString("base64url");
  return `${encodedSubject}.${expiresAtMs}.${mac(secret, purpose, subject, expiresAtMs).toString("base64url")}`;
}

/** Returns the subject when the token is well formed, unexpired and authentic for this purpose. Never throws. */
export function verifyToken(secret: string, token: string, purpose: LinkPurpose, nowMs: number): { subject: string } | null {
  if (token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedSubject = "", expiry = "", encodedSignature = ""] = parts;
  if (!encodedSubject || !expiry || !encodedSignature) return null;
  if (!/^(0|[1-9]\d{0,15})$/.test(expiry)) return null;

  const expiresAtMs = Number(expiry);
  if (!Number.isSafeInteger(expiresAtMs) || nowMs >= expiresAtMs) return null;

  const subjectBytes = decodeBase64url(encodedSubject);
  const signature = decodeBase64url(encodedSignature);
  if (!subjectBytes || subjectBytes.length === 0 || !signature) return null;

  const subject = subjectBytes.toString("utf8");
  const expected = mac(secret, purpose, subject, expiresAtMs);
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null;
  return { subject };
}

/**
 * Builds an absolute link to `path` carrying a signed token in `?t=`.
 * Throws when LINK_SIGNING_SECRET is not configured: callers must not send links that cannot be read back.
 */
export function signedLink(path: string, purpose: LinkPurpose, subject: string, ttlDays: number): string {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("signed link path must be a root-relative path");
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) throw new Error("signed link lifetime must be positive");
  const { LINK_SIGNING_SECRET } = linkSigningEnv();
  const token = signToken(LINK_SIGNING_SECRET, purpose, subject, Date.now() + ttlDays * DAY_MS);
  return `${publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}${path}?t=${token}`;
}

/** Subject of a valid token, or null when the token is missing, invalid, expired or the secret is not configured. */
export function readSignedLink(token: string | undefined, purpose: LinkPurpose): { subject: string } | null {
  if (!token || !isConfigured(linkSigningEnv)) return null;
  return verifyToken(linkSigningEnv().LINK_SIGNING_SECRET, token, purpose, Date.now());
}
