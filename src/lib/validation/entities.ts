import { z } from "zod";

import {
  nameField,
  optionalEmail,
  optionalIstDateTime,
  optionalPhone,
  optionalText,
  optionalUuid,
  istDateTime,
  searchTerm,
  uuidField,
} from "@/lib/validation/common";

export const LEAD_SOURCES = [
  "walk_in", "phone_call", "whatsapp", "website", "google", "instagram",
  "facebook", "referral", "practo", "justdial", "other",
] as const;
export const LEAD_STATUSES = ["new", "contacted", "qualified", "appointment_booked", "converted", "lost"] as const;
export const APPOINTMENT_TYPES = ["consultation", "follow_up", "procedure", "other"] as const;
export const APPOINTMENT_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;
export const TASK_STATUSES = ["open", "done", "cancelled"] as const;
export const INVITABLE_ROLES = ["admin", "staff", "viewer"] as const;

/** HTML checkboxes submit "on" when checked and nothing when not. */
const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
  .optional()
  .transform((value) => value === true || value === "on" || value === "true");

// Leads ---------------------------------------------------------------------------
export const leadInputSchema = z
  .object({
    fullName: nameField,
    phone: optionalPhone,
    email: optionalEmail,
    source: z.enum(LEAD_SOURCES).default("other"),
    status: z.enum(LEAD_STATUSES).default("new"),
    assignedTo: optionalUuid,
    nextFollowUpAt: optionalIstDateTime,
    notes: optionalText(2000),
    lostReason: optionalText(300),
  })
  .strict();
export type LeadInput = z.output<typeof leadInputSchema>;

export const leadFiltersSchema = z.object({
  q: searchTerm,
  status: z.enum(LEAD_STATUSES).optional().catch(undefined),
  source: z.enum(LEAD_SOURCES).optional().catch(undefined),
  followUp: z.enum(["overdue", "today", "upcoming"]).optional().catch(undefined),
  assignee: z.union([z.uuid(), z.literal("me"), z.literal("unassigned")]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
});
export type LeadFilters = z.output<typeof leadFiltersSchema>;

// Patients ------------------------------------------------------------------------
export const patientInputSchema = z
  .object({
    fullName: nameField,
    phone: optionalPhone,
    email: optionalEmail,
    whatsappConsent: checkbox,
    smsConsent: checkbox,
    emailConsent: checkbox,
    optedOut: checkbox,
  })
  .strict();
export type PatientInput = z.output<typeof patientInputSchema>;

export const patientFiltersSchema = z.object({
  q: searchTerm,
  archived: z.enum(["only", "include"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
});
export type PatientFilters = z.output<typeof patientFiltersSchema>;

// Appointments ----------------------------------------------------------------------
export const appointmentCreateSchema = z
  .object({
    patientId: optionalUuid,
    leadId: optionalUuid,
    startsAt: istDateTime,
    durationMinutes: z.coerce.number().int().min(5).max(480).default(30),
    appointmentType: z.enum(APPOINTMENT_TYPES).default("consultation"),
    assignedTo: optionalUuid,
    notes: optionalText(1000),
  })
  .strict()
  .refine((value) => value.patientId || value.leadId, {
    message: "Choose a patient or an inquiry.",
    path: ["patientId"],
  });
export type AppointmentCreateInput = z.output<typeof appointmentCreateSchema>;

export const appointmentUpdateSchema = z
  .object({
    startsAt: istDateTime,
    durationMinutes: z.coerce.number().int().min(5).max(480),
    appointmentType: z.enum(APPOINTMENT_TYPES),
    assignedTo: optionalUuid,
    notes: optionalText(1000),
  })
  .strict();
export type AppointmentUpdateInput = z.output<typeof appointmentUpdateSchema>;

export const appointmentStatusSchema = z
  .object({
    status: z.enum(APPOINTMENT_STATUSES),
    cancelReason: optionalText(300),
  })
  .strict();

export const appointmentFiltersSchema = z.object({
  range: z.enum(["today", "upcoming", "past", "all"]).default("upcoming").catch("upcoming"),
  status: z.enum(APPOINTMENT_STATUSES).optional().catch(undefined),
  assignee: z.union([z.uuid(), z.literal("me")]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
});
export type AppointmentFilters = z.output<typeof appointmentFiltersSchema>;

// Tasks ---------------------------------------------------------------------------
export const taskInputSchema = z
  .object({
    title: z.string().trim().min(1, "Required.").max(200),
    description: optionalText(2000),
    dueAt: optionalIstDateTime,
    assignedTo: optionalUuid,
    leadId: optionalUuid,
    patientId: optionalUuid,
    appointmentId: optionalUuid,
  })
  .strict();
export type TaskInput = z.output<typeof taskInputSchema>;

export const taskFiltersSchema = z.object({
  view: z.enum(["open", "overdue", "today", "done", "all"]).default("open").catch("open"),
  assignee: z.union([z.uuid(), z.literal("me")]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
});
export type TaskFilters = z.output<typeof taskFiltersSchema>;

// Team ------------------------------------------------------------------------------
export const inviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")).pipe(z.string().max(254)),
    role: z.enum(INVITABLE_ROLES),
  })
  .strict();

export const roleChangeSchema = z.object({ memberId: uuidField, role: z.enum(INVITABLE_ROLES) }).strict();

// Dashboard -------------------------------------------------------------------------
export const dateRangeSchema = z.object({
  range: z.enum(["7d", "30d", "90d", "month"]).default("30d").catch("30d"),
});

export { uuidField };
