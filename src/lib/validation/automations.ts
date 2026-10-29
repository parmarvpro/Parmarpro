import { z } from "zod";

const HOURS_MESSAGE = "Enter a whole number of hours, from 12 to 168.";
const MONTHS_MESSAGE = "Enter a whole number of months, from 1 to 24.";

/**
 * Clinic automation settings, as changed by owners and admins. Every key is
 * optional so one change can be sent alone, but the schema is strict: unknown
 * keys (for example round_robin_last_member, which the server owns) are refused.
 */
export const automationSettingsSchema = z
  .object({
    morning_digest: z.boolean().optional(),
    weekly_summary: z.boolean().optional(),
    untouched_lead_tasks: z.boolean().optional(),
    untouched_lead_hours: z.number(HOURS_MESSAGE).int(HOURS_MESSAGE).min(12, HOURS_MESSAGE).max(168, HOURS_MESSAGE).optional(),
    no_show_tasks: z.boolean().optional(),
    round_robin: z.boolean().optional(),
    recall_tasks: z.boolean().optional(),
    recall_months: z.number(MONTHS_MESSAGE).int(MONTHS_MESSAGE).min(1, MONTHS_MESSAGE).max(24, MONTHS_MESSAGE).optional(),
    patient_email_reminders: z.boolean().optional(),
    enquiry_form_enabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Nothing to change.");

export type AutomationSettingsInput = z.output<typeof automationSettingsSchema>;

/** A member's own staff-digest preference. Any member may change it for themselves. */
export const digestOptOutSchema = z.boolean();
