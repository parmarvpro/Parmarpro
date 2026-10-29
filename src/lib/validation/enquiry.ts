import { z } from "zod";

import { nameField, optionalEmail, optionalPhone, optionalText } from "@/lib/validation/common";

/** Public website enquiry form for one clinic. Strict: unknown fields are refused. */
export const enquirySchema = z
  .object({
    fullName: nameField,
    phone: optionalPhone,
    email: optionalEmail,
    message: optionalText(1500),
    consent: z.literal("on", "Tick the box to agree that the clinic may contact you."),
    // Honeypot: real users never see or fill this field.
    website: z.string().max(200).optional(),
  })
  .strict()
  .refine((value) => value.phone || value.email, {
    message: "Add a phone number or an email so the clinic can reply.",
    path: ["phone"],
  });

export type EnquiryInput = z.output<typeof enquirySchema>;

/** What the enquiry action returns to the form. Never reveals whether a key exists beyond "unavailable". */
export type EnquiryFormState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "invalid"; fieldErrors: Record<string, string[] | undefined> }
  | { status: "unavailable" }
  | { status: "busy" }
  | { status: "rate_limited" }
  | { status: "error" };
