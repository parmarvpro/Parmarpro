/**
 * Keyword urgency for an enquiry: pain and emergency words in English and in the common
 * romanised spellings of Hindi and Marathi. Pure. A keyword can only RAISE the urgency
 * the model gave; see raiseUrgency.
 */
import type { Urgency } from "@/lib/ai-triage";

const CALL_TODAY_TERMS = [
  "pain",
  "painful",
  "ache",
  "toothache",
  "swelling",
  "swollen",
  "bleeding",
  "blood",
  "broken",
  "cracked",
  "knocked out",
  "accident",
  "abscess",
  "pus",
  "fever",
  "can't eat",
  "cannot sleep",
  "emergency",
  "urgent",
  "dard",
  "dukh",
  "dukhta",
  "sujan",
  "soojan",
  "khoon",
  "toot",
  "tuta",
];

const WORD_CHARACTER = String.raw`[\p{L}\p{M}\p{N}]`;

/** One term as a pattern: its words in order, separated by any run of spaces. */
function termPattern(term: string): string {
  return term
    .split(" ")
    .map((word) => word.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&"))
    .join(String.raw`\s+`);
}

// Whole words only, so "pained" and "toothbrush" do not match "pain" and "tooth" does not match "toot".
const CALL_TODAY = new RegExp(
  `(?<!${WORD_CHARACTER})(?:${CALL_TODAY_TERMS.map(termPattern).join("|")})(?!${WORD_CHARACTER})`,
  "iu",
);

/** "call_today" when the text has a pain or emergency word, otherwise null. Apostrophes are normalised first. */
export function keywordUrgency(text: string): "call_today" | null {
  return CALL_TODAY.test(text.normalize("NFKC").replace(/[‘’ʼ`]/g, "'")) ? "call_today" : null;
}

const RANK: Record<Urgency, number> = { routine: 0, soon: 1, call_today: 2 };

/** The higher of the model's urgency and the keyword urgency. A keyword never lowers the model's answer. */
export function raiseUrgency(ai: Urgency, keyword: Urgency | null): Urgency {
  return keyword !== null && RANK[keyword] > RANK[ai] ? keyword : ai;
}
