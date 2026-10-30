/**
 * Live smoke test for the free Gemini lane. It sends ONE operations-note request, built from
 * all-zero counts, with the real fetch and the free key. It is skipped unless
 * GEMINI_FREE_API_KEY is set, so it never runs by accident. It prints the status, the model
 * and the token counts only: never the note text.
 */
import { describe, expect, it } from "vitest";

import { OPS_COUNT_KEYS, type OpsCounts } from "@/lib/ops-counts";
import { OPS_NOTE_SCHEMA, OPS_NOTE_SYSTEM, OpsNoteSchema, opsNoteInput } from "@/server/ai/features/ops-note";
import { AI_MODEL_CHAINS } from "@/server/ai/models";
import { createGeminiTransport } from "@/server/ai/transport";

const apiKey = process.env.GEMINI_FREE_API_KEY;

describe("free Gemini lane, live", () => {
  it.skipIf(!apiKey)("answers one operations-note request", async () => {
    const zero = Object.fromEntries(OPS_COUNT_KEYS.map((key) => [key, 0])) as OpsCounts;
    const transport = createGeminiTransport({ fetch: (input, init) => fetch(input, init), apiKey: apiKey! });
    const model = AI_MODEL_CHAINS.free.manager[0]!;

    const result = await transport.generate({
      model,
      system: OPS_NOTE_SYSTEM,
      input: opsNoteInput(zero),
      schema: OPS_NOTE_SCHEMA,
      parse: OpsNoteSchema,
      thinkingLevel: "low",
      temperature: 0.2,
    });

    const usage = "usage" in result ? result.usage : null;
    console.info(
      `[ai-smoke] status=${result.ok ? "ok" : result.reason} model=${model} ` +
        `input_tokens=${usage?.inputTokens ?? "n/a"} output_tokens=${usage?.outputTokens ?? "n/a"} ` +
        `thought_tokens=${usage?.thoughtTokens ?? "n/a"}`,
    );
    expect(result.ok).toBe(true);
  }, 60_000);
});
