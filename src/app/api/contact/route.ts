import { after } from "next/server";

import { contactRequestSchema } from "@/lib/validation/contact";
import { AppError } from "@/server/auth/errors";
import { notifyEnquiry } from "@/server/automations/enquiry-notifications";
import { createAnonDb } from "@/server/db/anon-client";
import { throwIfDbError } from "@/server/db/errors";
import { errorResponse, jsonResponse, readJsonBody } from "@/server/http";
import { clientIp, createRateLimiter } from "@/server/rate-limit";
import { parseInput } from "@/server/validation";

const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

/** Public marketing contact form. Insert-only; nothing can be read back. */
export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError("invalid_input");
    if (!limiter.check(clientIp(request))) throw new AppError("rate_limited");
    const input = parseInput(contactRequestSchema, await readJsonBody(request, 8 * 1024));
    // Honeypot filled: pretend success, store nothing.
    if (input.website) return jsonResponse({ ok: true });
    const { data: enquiryId, error } = await createAnonDb().rpc("submit_contact_request", {
      p_full_name: input.fullName,
      p_clinic_name: input.clinicName ?? "",
      p_phone_e164: input.phone ?? "",
      p_email: input.email ?? "",
      p_city: input.city ?? "",
      p_message: input.message ?? "",
    });
    throwIfDbError(error);
    // Emails go out after the response. notifyEnquiry never throws, so they cannot change it.
    if (enquiryId) {
      after(() =>
        notifyEnquiry({
          id: enquiryId,
          fullName: input.fullName,
          clinicName: input.clinicName,
          phone: input.phone,
          email: input.email,
          city: input.city,
          message: input.message,
        }),
      );
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    return errorResponse(error, "api.contact");
  }
}
