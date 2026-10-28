import { z } from "zod";

export const clinicSetupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the clinic name.").max(120),
    city: z.string().trim().min(1, "Enter the city.").max(80).default("Mumbai"),
  })
  .strict();

export const clinicSettingsSchema = clinicSetupSchema;
