import { humanize } from "@/lib/format";

type ActivityEvent = { entity_type: string; action: string; metadata: unknown };

const FIELD_LABELS: Record<string, string> = {
  full_name: "name",
  phone_e164: "phone",
  email: "email",
  source: "source",
  status: "status",
  assigned_to: "assignee",
  next_follow_up_at: "follow-up date",
  notes: "notes",
  lost_reason: "lost reason",
  patient_id: "linked patient",
  starts_at: "time",
  duration_minutes: "duration",
  appointment_type: "type",
  cancel_reason: "cancellation reason",
  title: "title",
  description: "details",
  due_at: "due date",
  whatsapp_consent: "WhatsApp consent",
  sms_consent: "SMS consent",
  email_consent: "email consent",
  consent_recorded_at: "consent",
  opted_out_at: "opt-out",
  archived_at: "archive status",
};

/** Human-readable description of an activity event (no personal data involved). */
export function describeActivity(event: ActivityEvent): string {
  const meta = (event.metadata && typeof event.metadata === "object" ? event.metadata : {}) as Record<string, unknown>;
  const entity = humanize(event.entity_type);
  switch (event.action) {
    case "created":
      return typeof meta.status === "string" ? `${entity} created (${humanize(meta.status)})` : `${entity} created`;
    case "deleted":
      return `${entity} deleted`;
    case "updated": {
      if (typeof meta.from === "string" && typeof meta.to === "string") {
        return `${entity} status: ${humanize(meta.from)} → ${humanize(meta.to)}`;
      }
      const fields = Array.isArray(meta.fields) ? (meta.fields as string[]).map((field) => FIELD_LABELS[field] ?? humanize(field)) : [];
      return fields.length ? `${entity} updated: ${fields.join(", ")}` : `${entity} updated`;
    }
    case "role_changed":
      return `Team role changed: ${humanize(String(meta.from ?? ""))} → ${humanize(String(meta.to ?? ""))}`;
    case "removed":
      return "Team member removed";
    case "joined":
      return `Team member joined as ${humanize(String(meta.role ?? "member"))}`;
    case "revoked":
      return "Invitation revoked";
    default:
      return `${entity} ${humanize(event.action).toLowerCase()}`;
  }
}
