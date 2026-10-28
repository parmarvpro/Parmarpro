import { humanize } from "@/lib/format";
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES, LEAD_SOURCES, LEAD_STATUSES } from "@/lib/validation/entities";

const SOURCE_LABELS: Record<string, string> = {
  walk_in: "Walk-in",
  phone_call: "Phone call",
  whatsapp: "WhatsApp",
  website: "Website",
  google: "Google",
  instagram: "Instagram",
  facebook: "Facebook",
  referral: "Referral",
  practo: "Practo",
  justdial: "Justdial",
  other: "Other",
};

export const sourceLabel = (value: string) => SOURCE_LABELS[value] ?? humanize(value);
export const leadSourceOptions = LEAD_SOURCES.map((value) => ({ value, label: sourceLabel(value) }));
export const leadStatusOptions = LEAD_STATUSES.map((value) => ({ value, label: humanize(value) }));
export const appointmentTypeOptions = APPOINTMENT_TYPES.map((value) => ({ value, label: humanize(value) }));
export const appointmentStatusOptions = APPOINTMENT_STATUSES.map((value) => ({ value, label: humanize(value) }));

export type MemberOption = { id: string; display_name: string | null; role: string };
export const memberLabel = (member: MemberOption) => member.display_name ?? `Team member (${member.role})`;
