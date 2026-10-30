import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BEST_TIME_MAX,
  CONFIDENCES,
  LANGUAGE_LABELS,
  LANGUAGES,
  SUMMARY_MAX,
  TREATMENT_LABELS,
  TREATMENTS,
  TriageSchema,
  URGENCIES,
  URGENCY_LABELS,
  triageRow,
} from "@/lib/ai-triage";

const VALID = {
  treatment: "pain_emergency",
  urgency: "call_today",
  language: "hi",
  best_time: "after 6 pm",
  summary: "Asks for a same-day slot for tooth pain.",
  confidence: "high",
} as const;

describe("TriageSchema", () => {
  it("accepts a complete answer", () => {
    expect(TriageSchema.parse(VALID)).toEqual(VALID);
  });

  it("refuses an unknown key, a missing key and values outside the sets", () => {
    expect(TriageSchema.safeParse({ ...VALID, phone: "+919800000077" }).success).toBe(false);
    const withoutSummary: Record<string, unknown> = { ...VALID };
    delete withoutSummary.summary;
    expect(TriageSchema.safeParse(withoutSummary).success).toBe(false);
    expect(TriageSchema.safeParse({ ...VALID, treatment: "botox" }).success).toBe(false);
    expect(TriageSchema.safeParse({ ...VALID, urgency: "critical" }).success).toBe(false);
    expect(TriageSchema.safeParse({ ...VALID, language: "fr" }).success).toBe(false);
    expect(TriageSchema.safeParse({ ...VALID, confidence: "medium" }).success).toBe(false);
  });

  it("trims the summary and refuses an empty or over-long one", () => {
    expect(TriageSchema.parse({ ...VALID, summary: "  Asks about a check-up.  " }).summary).toBe("Asks about a check-up.");
    expect(TriageSchema.safeParse({ ...VALID, summary: "   " }).success).toBe(false);
    expect(TriageSchema.safeParse({ ...VALID, summary: "x".repeat(SUMMARY_MAX) }).success).toBe(true);
    expect(TriageSchema.safeParse({ ...VALID, summary: "x".repeat(SUMMARY_MAX + 1) }).success).toBe(false);
  });

  it("keeps a best time up to the limit, reads an empty one as none, and refuses a longer one", () => {
    expect(TriageSchema.parse({ ...VALID, best_time: null }).best_time).toBe(null);
    expect(TriageSchema.parse({ ...VALID, best_time: "   " }).best_time).toBe(null);
    expect(TriageSchema.parse({ ...VALID, best_time: "x".repeat(BEST_TIME_MAX) }).best_time).toHaveLength(BEST_TIME_MAX);
    expect(TriageSchema.safeParse({ ...VALID, best_time: "x".repeat(BEST_TIME_MAX + 1) }).success).toBe(false);
  });
});

describe("the enums match the database check constraints", () => {
  const migration = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/20261030120000_ai.sql"), "utf8");

  /** The quoted values of one check constraint's "<column> in (...)" list in the migration. */
  function checkValues(column: string): string[] {
    const match = new RegExp(`${column} text not null check \\(${column} in \\(([^)]*)\\)`).exec(migration);
    if (!match?.[1]) throw new Error(`no check list for ${column}`);
    return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]!);
  }

  it("treatment, urgency and language", () => {
    expect([...TREATMENTS].sort()).toEqual(checkValues("treatment").sort());
    expect([...URGENCIES].sort()).toEqual(checkValues("urgency").sort());
    expect([...LANGUAGES].sort()).toEqual(checkValues("language").sort());
  });

  it("every value has a label", () => {
    expect(Object.keys(TREATMENT_LABELS).sort()).toEqual([...TREATMENTS].sort());
    expect(Object.keys(URGENCY_LABELS).sort()).toEqual([...URGENCIES].sort());
    expect(Object.keys(LANGUAGE_LABELS).sort()).toEqual([...LANGUAGES].sort());
  });

  it("confidence has the two values the schema allows", () => {
    expect([...CONFIDENCES].sort()).toEqual(["high", "low"]);
  });
});

describe("triageRow", () => {
  it("is exactly the stored columns, with the model", () => {
    const parsed = TriageSchema.parse(VALID);
    expect(triageRow(parsed, "gemini-3.5-flash-lite")).toEqual({
      treatment: "pain_emergency",
      urgency: "call_today",
      language: "hi",
      best_time: "after 6 pm",
      summary: "Asks for a same-day slot for tooth pain.",
      model: "gemini-3.5-flash-lite",
    });
  });
});
