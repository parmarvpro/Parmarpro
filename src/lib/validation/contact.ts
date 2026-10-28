import { z } from "zod";

import { nameField, optionalEmail, optionalPhone, optionalText } from "@/lib/validation/common";

export const contactRequestSchema = z
  .object({
    fullName: nameField,
    clinicName: optionalText(120),
    phone: optionalPhone,
    email: optionalEmail,
    city: optionalText(80),
    message: optionalText(2000),
    // Honeypot: real users never see or fill this field.
    website: z.string().max(200).optional(),
  })
  .strict()
  .refine((value) => value.phone || value.email, {
    message: "Add a phone number or an email so we can reply.",
    path: ["phone"],
  });

export type ContactRequestInput = z.input<typeof contactRequestSchema>;
