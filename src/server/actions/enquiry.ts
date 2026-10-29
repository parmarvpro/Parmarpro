"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { reportError } from "@/lib/observability/report";
import { enquirySchema, type EnquiryFormState } from "@/lib/validation/enquiry";
import { createRateLimiter, ipFromHeaders } from "@/server/rate-limit";
import { createWebsiteLead, findEnquiryClinic, websiteEnquiriesToday } from "@/server/privileged/enquiry";

/**
 * The public website enquiry form. There is no login: the clinic key in the
 * bound argument selects the clinic, and every check runs again on each
 * submission. The result never says whether a key exists, beyond "unavailable".
 */

const AREA = "enquiry.form";
/** Website enquiries per clinic per IST day. Stops a flood from filling the leads list. Not exported: "use server" modules export only actions. */
const WEBSITE_DAILY_CAP = 50;

const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

function field(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/** Bound with the clinic key: submitEnquiryAction.bind(null, key). */
export async function submitEnquiryAction(key: string, _previous: EnquiryFormState, formData: FormData): Promise<EnquiryFormState> {
  try {
    if (!limiter.check(ipFromHeaders(await headers()))) return { status: "rate_limited" };

    // Only the known fields are read, so no extra form data (such as framework fields) reaches the schema.
    const parsed = enquirySchema.safeParse({
      fullName: field(formData, "fullName"),
      phone: field(formData, "phone"),
      email: field(formData, "email"),
      message: field(formData, "message"),
      consent: field(formData, "consent"),
      website: field(formData, "website"),
    });
    if (!parsed.success) return { status: "invalid", fieldErrors: z.flattenError(parsed.error).fieldErrors };
    const input = parsed.data;

    // Honeypot filled: report success, store nothing.
    if (input.website) return { status: "sent" };

    const clinic = await findEnquiryClinic(key);
    if (!clinic) return { status: "unavailable" };
    if ((await websiteEnquiriesToday(clinic.clinicId)) >= WEBSITE_DAILY_CAP) return { status: "busy" };

    await createWebsiteLead({
      clinicId: clinic.clinicId,
      fullName: input.fullName,
      phone: input.phone,
      email: input.email,
      message: input.message,
    });
    return { status: "sent" };
  } catch (error) {
    reportError(error, { area: AREA });
    return { status: "error" };
  }
}
