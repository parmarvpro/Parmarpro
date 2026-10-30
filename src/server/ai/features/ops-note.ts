import "server-only";

import { z } from "zod";

import { reportError } from "@/lib/observability/report";
import { OPS_COUNT_KEYS, type OpsCounts } from "@/lib/ops-counts";
import { freeLane } from "@/server/ai/free-lane";
import { AI_MODEL_CHAINS } from "@/server/ai/models";
import type { AiRunner, AiTask } from "@/server/ai/run";

/**
 * The operations note: a few plain sentences on what needs attention, written from the
 * day's operations counts. This is the only file that may import the free lane, and the
 * free lane may receive only our own non-personal data. So the model's input is built
 * from the fixed count keys and their numbers, and from nothing else.
 */

const OPS_NOTE_FEATURE = "ops_note";

export const OPS_NOTE_SYSTEM = [
  "You are the operations assistant for a small software company.",
  "You receive a JSON object of counts for the last 24 hours. Each key names one count, and its value is that count.",
  "Reply with the JSON the schema asks for.",
  "In \"note\", write at most three short sentences: what needs attention first, and what to check. If nothing needs attention, say so in one sentence.",
  "Use only the numbers and keys you are given. Do not invent figures, causes or names. Do not greet the reader.",
  "Set \"attention\" to \"high\" when a failure or a missed job needs action today, \"low\" when something is worth a look, and \"none\" when nothing needs attention.",
].join(" ");

/** JSON Schema for the answer. Bounded, as the transport requires. */
export const OPS_NOTE_SCHEMA = {
  type: "object",
  properties: {
    attention: { type: "string", enum: ["none", "low", "high"] },
    note: { type: "string", minLength: 1, maxLength: 400 },
  },
  required: ["attention", "note"],
};

export const OpsNoteSchema = z.strictObject({
  attention: z.enum(["none", "low", "high"]),
  note: z.string().min(1).max(400),
});

export type OpsNote = z.infer<typeof OpsNoteSchema>;

/**
 * The model's input: a JSON object of the fixed count keys and their numbers. It is built
 * key by key, so a property added to the counts object can never reach the model.
 */
export function opsNoteInput(counts: OpsCounts): string {
  return JSON.stringify(Object.fromEntries(OPS_COUNT_KEYS.map((key) => [key, Number(counts[key])])));
}

export type OpsNoteDeps = { runner: AiRunner };

/**
 * Builds the note with the given runner. Resolves to null when no model answers, and
 * never throws: a failure is reported with its code only.
 */
export function createOpsNote(deps: OpsNoteDeps): (counts: OpsCounts) => Promise<OpsNote | null> {
  return async (counts) => {
    try {
      const task: AiTask<OpsNote> = {
        feature: OPS_NOTE_FEATURE,
        clinicId: null,
        system: OPS_NOTE_SYSTEM,
        input: opsNoteInput(counts),
        schema: OPS_NOTE_SCHEMA,
        parse: OpsNoteSchema,
        thinkingLevel: "low",
        temperature: 0.2,
      };
      // The manager writes the note. The workers are the fallback, tried in order when it cannot.
      const models = [...AI_MODEL_CHAINS.free.manager, ...AI_MODEL_CHAINS.free.worker];
      const outcome = await deps.runner.run(task, models);
      return outcome.status === "ok" ? outcome.value : null;
    } catch (error) {
      reportError(error, { area: "ai.ops_note", code: "run" });
      return null;
    }
  };
}

/**
 * The production note, through the free lane. The lane is built on the first call, not at
 * import, so importing this file reads no configuration.
 */
export async function opsNote(counts: OpsCounts): Promise<OpsNote | null> {
  try {
    return await createOpsNote({ runner: freeLane() })(counts);
  } catch (error) {
    reportError(error, { area: "ai.ops_note", code: "lane" });
    return null;
  }
}
