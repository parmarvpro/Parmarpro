/**
 * The AI's triage of one enquiry: the shape the model must answer in, the values the
 * database accepts, and the labels the UI shows. Pure, with no server imports, so the
 * server and the components share it. The values match the check constraints of
 * public.lead_ai_triage (supabase/migrations/20261030120000_ai.sql).
 */
import { z } from "zod";

export const TREATMENTS = [
  "checkup_cleaning",
  "pain_emergency",
  "braces_aligners",
  "implants",
  "root_canal",
  "crowns_bridges",
  "whitening_cosmetic",
  "dentures",
  "children",
  "other",
  "unclear",
] as const;
export type Treatment = (typeof TREATMENTS)[number];

export const URGENCIES = ["call_today", "soon", "routine"] as const;
export type Urgency = (typeof URGENCIES)[number];

export const LANGUAGES = ["en", "hi", "mr", "gu", "other", "unknown"] as const;
export type Language = (typeof LANGUAGES)[number];

export const CONFIDENCES = ["high", "low"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const BEST_TIME_MAX = 60;
export const SUMMARY_MAX = 160;

/** The model's answer, checked strictly. Any extra key, or a value outside these sets, is refused. */
export const TriageSchema = z.strictObject({
  treatment: z.enum(TREATMENTS),
  urgency: z.enum(URGENCIES),
  language: z.enum(LANGUAGES),
  best_time: z
    .string()
    .trim()
    .max(BEST_TIME_MAX)
    .nullable()
    .transform((value) => (value ? value : null)),
  summary: z.string().trim().min(1).max(SUMMARY_MAX),
  confidence: z.enum(CONFIDENCES),
});

export type Triage = z.output<typeof TriageSchema>;

export const TREATMENT_LABELS: Record<Treatment, string> = {
  checkup_cleaning: "Check-up / cleaning",
  pain_emergency: "Pain / emergency",
  braces_aligners: "Braces / aligners",
  implants: "Implants",
  root_canal: "Root canal",
  crowns_bridges: "Crowns / bridges",
  whitening_cosmetic: "Whitening / cosmetic",
  dentures: "Dentures",
  children: "Children's dentistry",
  other: "Other",
  unclear: "Unclear",
};

export const URGENCY_LABELS: Record<Urgency, string> = {
  call_today: "Call today",
  soon: "Soon",
  routine: "Routine",
};

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  hi: "Hindi",
  mr: "Marathi",
  gu: "Gujarati",
  other: "Other",
  unknown: "Unknown",
};

/** The stored row for a triage. The lead, the clinic and the time are set by the caller or the database. */
export function triageRow(triage: Triage, model: string) {
  return {
    treatment: triage.treatment,
    urgency: triage.urgency,
    language: triage.language,
    best_time: triage.best_time,
    summary: triage.summary,
    model,
  };
}
