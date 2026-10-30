import { createHash } from "node:crypto";

/** SHA-256 of a raw webhook body, stored (not the body) as the receipt fingerprint. */
export function sha256Hex(payload: string): string {
  return createHash("sha256").update(payload, "utf8").digest("hex");
}
