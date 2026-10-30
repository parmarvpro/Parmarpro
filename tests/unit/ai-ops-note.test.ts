import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import { OPS_COUNT_KEYS, type OpsCounts } from "@/lib/ops-counts";
import {
  createOpsNote,
  OPS_NOTE_SCHEMA,
  OPS_NOTE_SYSTEM,
  OpsNoteSchema,
  opsNoteInput,
} from "@/server/ai/features/ops-note";
import { AI_MODEL_CHAINS } from "@/server/ai/models";
import { createAiRunner, type AiRunner, type AiRunnerDeps } from "@/server/ai/run";
import type { GenerateRequest, GenerateResult, ReserveParams, Transport } from "@/server/ai/types";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

const MANAGER = AI_MODEL_CHAINS.free.manager[0]!;
const WORKER = AI_MODEL_CHAINS.free.worker[0]!;
const WORKER_FALLBACK = AI_MODEL_CHAINS.free.worker[1]!;

// Synthetic values. The counts are numbers only, as the database returns them.
const COUNTS: OpsCounts = {
  job_runs: 6,
  job_runs_failed: 1,
  jobs_not_run: 0,
  emails_failed: 0,
  email_budget_hits: 0,
  emails_sent_today: 4,
  webhooks_failed: 0,
  ai_calls: 3,
  ai_calls_failed: 0,
  ai_calls_rate_limited: 0,
};

const NOTE = { attention: "high" as const, note: "One job run failed. Check the staff digest log first." };

type SentRequest = Pick<GenerateRequest<unknown>, "model" | "system" | "input" | "thinkingLevel" | "temperature">;

/**
 * A real runner over a fake transport. Each model in `failing` answers with a failure; any
 * other model answers with NOTE. Reservations and requests are recorded in order.
 */
function harness(options: { failing?: string[]; noKey?: boolean } = {}) {
  const requests: SentRequest[] = [];
  const transport: Transport = {
    async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
      requests.push({ model: req.model, system: req.system, input: req.input, thinkingLevel: req.thinkingLevel, temperature: req.temperature });
      if (options.failing?.includes(req.model)) return { ok: false, reason: "failed" };
      return { ok: true, value: req.parse.parse(NOTE), usage: null };
    },
  };
  const reservations: ReserveParams[] = [];
  const reserve = vi.fn<AiRunnerDeps["reserve"]>(async (params) => {
    reservations.push(params);
    return reservations.length;
  });
  const settle = vi.fn<AiRunnerDeps["settle"]>(async () => {});
  const runner = createAiRunner({
    lane: "free",
    transport: options.noKey ? null : transport,
    reserve,
    settle,
    clinicDailyCap: null,
  });
  return { runner, requests, reservations, reserve };
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

describe("createOpsNote, the model chain", () => {
  it("answers from the manager model when it is available", async () => {
    const h = harness();
    const note = await createOpsNote({ runner: h.runner })(COUNTS);

    expect(note).toEqual(NOTE);
    expect(h.reservations.map((params) => params.model)).toEqual([MANAGER]);
  });

  it("falls back to the worker models, in order, when the manager fails", async () => {
    const h = harness({ failing: [MANAGER, WORKER] });
    const note = await createOpsNote({ runner: h.runner })(COUNTS);

    expect(note).toEqual(NOTE);
    expect(h.reservations.map((params) => params.model)).toEqual([MANAGER, WORKER, WORKER_FALLBACK]);
  });

  it("sends the fixed request: low thinking, temperature 0.2, the ops_note feature, no clinic", async () => {
    const h = harness();
    await createOpsNote({ runner: h.runner })(COUNTS);

    expect(h.requests[0]).toEqual({
      model: MANAGER,
      system: OPS_NOTE_SYSTEM,
      input: opsNoteInput(COUNTS),
      thinkingLevel: "low",
      temperature: 0.2,
    });
    expect(h.reservations[0]).toMatchObject({ lane: "free", feature: "ops_note", clinicId: null });
  });

  it("returns null, with nothing reserved or sent, when the free lane has no key", async () => {
    const h = harness({ noKey: true });
    await expect(createOpsNote({ runner: h.runner })(COUNTS)).resolves.toBeNull();
    expect(h.reserve).not.toHaveBeenCalled();
    expect(h.requests).toEqual([]);
  });

  it("returns null when every model in the chain fails", async () => {
    const h = harness({ failing: [MANAGER, WORKER, WORKER_FALLBACK] });
    await expect(createOpsNote({ runner: h.runner })(COUNTS)).resolves.toBeNull();
    expect(h.reservations.map((params) => params.model)).toEqual([MANAGER, WORKER, WORKER_FALLBACK]);
  });
});

describe("createOpsNote, never throws", () => {
  it("returns null and reports the failure with its code only", async () => {
    const runner: AiRunner = {
      run: async () => {
        throw new Error("Synthetic failure with job_runs: 6 in the message");
      },
      runWithEscalation: async () => {
        throw new Error("unused");
      },
    };

    await expect(createOpsNote({ runner })(COUNTS)).resolves.toBeNull();

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "ai.ops_note", code: "run" });
  });
});

describe("opsNoteInput, the only text the free lane receives", () => {
  it("is a JSON object with exactly the fixed count keys, each an integer", () => {
    const sent = JSON.parse(opsNoteInput(COUNTS)) as Record<string, unknown>;

    expect(Object.keys(sent)).toEqual([...OPS_COUNT_KEYS]);
    for (const value of Object.values(sent)) expect(Number.isInteger(value)).toBe(true);
  });

  it("never carries a property added to the counts object", () => {
    const smuggled = { ...COUNTS, secret: "Synthetic Patient Name", email: "patient@example.test" } as OpsCounts;
    const input = opsNoteInput(smuggled);

    expect(input).not.toContain("secret");
    expect(input).not.toContain("Synthetic");
    expect(input).not.toContain("example.test");
    expect(Object.keys(JSON.parse(input))).toEqual([...OPS_COUNT_KEYS]);
  });

  it("sends the numbers it was given, under their keys", () => {
    expect(JSON.parse(opsNoteInput(COUNTS))).toEqual(COUNTS);
  });
});

describe("the operations note contract", () => {
  it("asks for at most three short sentences, no greeting, and only the numbers given", () => {
    expect(OPS_NOTE_SYSTEM).toContain("at most three short sentences");
    expect(OPS_NOTE_SYSTEM).toContain("Do not greet the reader");
    expect(OPS_NOTE_SYSTEM).toContain("Use only the numbers");
  });

  it("bounds the note to 400 characters and the attention level to three values", () => {
    expect(OPS_NOTE_SCHEMA.properties.note).toEqual({ type: "string", minLength: 1, maxLength: 400 });
    expect(OPS_NOTE_SCHEMA.properties.attention.enum).toEqual(["none", "low", "high"]);
  });

  it("accepts a valid note and rejects an empty or long note, an unknown level and an extra key", () => {
    expect(OpsNoteSchema.safeParse(NOTE).success).toBe(true);
    expect(OpsNoteSchema.safeParse({ attention: "none", note: "" }).success).toBe(false);
    expect(OpsNoteSchema.safeParse({ attention: "none", note: "x".repeat(401) }).success).toBe(false);
    expect(OpsNoteSchema.safeParse({ attention: "critical", note: "x" }).success).toBe(false);
    expect(OpsNoteSchema.safeParse({ attention: "none", note: "x", extra: 1 }).success).toBe(false);
  });
});
