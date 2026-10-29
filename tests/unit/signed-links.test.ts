import { describe, expect, it } from "vitest";

import { signToken, verifyToken, type LinkPurpose } from "@/server/signed-links";

// Test-only value, not a real secret.
const SECRET = "test_link_secret_0123456789abcdef0123456789";
const SUBJECT = "5f0c2a1e-7b1d-4c8e-9f3a-2d6b8e4c1a90";
const EXPIRES = Date.parse("2026-11-05T00:00:00Z");
const BEFORE_EXPIRY = EXPIRES - 60_000;
const PURPOSE: LinkPurpose = "enquiry_action";

const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64url");

describe("signed link tokens", () => {
  it("round-trips the subject for the same purpose before expiry", () => {
    const token = signToken(SECRET, PURPOSE, SUBJECT, EXPIRES);
    expect(verifyToken(SECRET, token, PURPOSE, BEFORE_EXPIRY)).toEqual({ subject: SUBJECT });
  });

  it("is accepted one millisecond before expiry and rejected at expiry", () => {
    const token = signToken(SECRET, PURPOSE, SUBJECT, EXPIRES);
    expect(verifyToken(SECRET, token, PURPOSE, EXPIRES - 1)).toEqual({ subject: SUBJECT });
    expect(verifyToken(SECRET, token, PURPOSE, EXPIRES)).toBeNull();
  });

  it("rejects a token presented for a different purpose", () => {
    const token = signToken(SECRET, "digest_unsubscribe", SUBJECT, EXPIRES);
    expect(verifyToken(SECRET, token, "patient_email_opt_out", BEFORE_EXPIRY)).toBeNull();
    expect(verifyToken(SECRET, token, "digest_unsubscribe", BEFORE_EXPIRY)).toEqual({ subject: SUBJECT });
  });

  it("rejects a token signed with another secret", () => {
    const token = signToken("another_secret_0123456789abcdef0123456789", PURPOSE, SUBJECT, EXPIRES);
    expect(verifyToken(SECRET, token, PURPOSE, BEFORE_EXPIRY)).toBeNull();
  });

  it("rejects a tampered subject", () => {
    const [, expiry, signature] = signToken(SECRET, PURPOSE, SUBJECT, EXPIRES).split(".");
    const forged = `${b64("9a9a9a9a-0000-4000-8000-000000000000")}.${expiry}.${signature}`;
    expect(verifyToken(SECRET, forged, PURPOSE, BEFORE_EXPIRY)).toBeNull();
  });

  it("rejects an extended expiry", () => {
    const [subject, , signature] = signToken(SECRET, PURPOSE, SUBJECT, EXPIRES).split(".");
    const extended = `${subject}.${EXPIRES + 365 * 24 * 60 * 60 * 1000}.${signature}`;
    expect(verifyToken(SECRET, extended, PURPOSE, BEFORE_EXPIRY)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const [subject, expiry, signature = ""] = signToken(SECRET, PURPOSE, SUBJECT, EXPIRES).split(".");
    const flipped = `${signature.slice(0, 10)}${signature[10] === "A" ? "B" : "A"}${signature.slice(11)}`;
    expect(verifyToken(SECRET, `${subject}.${expiry}.${flipped}`, PURPOSE, BEFORE_EXPIRY)).toBeNull();
  });

  it("rejects an expired token even when the signature is valid", () => {
    const token = signToken(SECRET, PURPOSE, SUBJECT, EXPIRES);
    expect(verifyToken(SECRET, token, PURPOSE, EXPIRES + 1)).toBeNull();
  });

  it.each([
    ["one part", "abc"],
    ["two parts", "abc.123"],
    ["four parts", "a.1.b.c"],
    ["empty string", ""],
    ["empty subject", `.${EXPIRES}.AAAA`],
    ["empty signature", `${b64(SUBJECT)}.${EXPIRES}.`],
    ["non-numeric expiry", `${b64(SUBJECT)}.soon.AAAA`],
    ["signed expiry with a sign", `${b64(SUBJECT)}.+${EXPIRES}.AAAA`],
    ["bad base64 subject", `@@@.${EXPIRES}.AAAA`],
    ["non-canonical base64 subject", `YR.${EXPIRES}.AAAA`],
    ["signature of the wrong length", `${b64(SUBJECT)}.${EXPIRES}.AAAA`],
    ["oversized token", "a".repeat(600)],
  ])("rejects a malformed token (%s)", (_name, token) => {
    expect(verifyToken(SECRET, token, PURPOSE, BEFORE_EXPIRY)).toBeNull();
  });

  it("refuses to sign a subject that spans lines or is empty", () => {
    expect(() => signToken(SECRET, PURPOSE, "a\nb", EXPIRES)).toThrow();
    expect(() => signToken(SECRET, PURPOSE, "", EXPIRES)).toThrow();
  });

  it("signs the longest allowed subject into a token that verifies", () => {
    const longest = "s".repeat(200);
    const token = signToken(SECRET, PURPOSE, longest, EXPIRES);
    expect(token.length).toBeLessThan(512);
    expect(verifyToken(SECRET, token, PURPOSE, BEFORE_EXPIRY)).toEqual({ subject: longest });
    expect(() => signToken(SECRET, PURPOSE, "s".repeat(201), EXPIRES)).toThrow();
  });
});
