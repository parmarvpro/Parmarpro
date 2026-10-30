import "server-only";

import type { ZodType } from "zod";

import { reportError } from "@/lib/observability/report";
import { estimateInputTokens, type AiLane, type AiModelChains } from "@/server/ai/models";
import type {
  AiCallStatus,
  AiThinkingLevel,
  AiUsage,
  GenerateResult,
  ReserveParams,
  Transport,
} from "@/server/ai/types";

/**
 * Runs one AI task down a chain of models. Every attempt is reserved first, so the
 * limits hold, then sent, then settled once with its outcome. A model that refuses
 * the reservation, is rate limited, returns unusable output or fails hands over to
 * the next model in the chain.
 */

const FEATURE_PATTERN = /^[a-z_]{1,40}$/;

export type AiTask<T> = {
  feature: string;
  clinicId: string | null;
  system: string;
  input: string;
  /** JSON Schema for the output. Bound every string and array in it. */
  schema: object;
  parse: ZodType<T>;
  thinkingLevel: AiThinkingLevel;
  temperature: number;
};

export type AiRunResult<T> = { status: "ok"; value: T; model: string } | { status: "unavailable" };

export type EscalationChains<T> = AiModelChains & { needsManager(value: T): boolean };

export type AiRunnerDeps = {
  lane: AiLane;
  /** Null when the lane's key is not configured. Nothing is reserved or sent then. */
  transport: Transport | null;
  reserve(params: ReserveParams): Promise<number | null>;
  settle(id: number, status: AiCallStatus, usage: AiUsage | null): Promise<void>;
  clinicDailyCap: number | null;
};

export type AiRunner = {
  run<T>(task: AiTask<T>, models: readonly string[]): Promise<AiRunResult<T>>;
  /** Runs the worker chain, then the manager chain once when the worker is unavailable or needsManager says so. */
  runWithEscalation<T>(task: AiTask<T>, chains: EscalationChains<T>): Promise<AiRunResult<T>>;
};

export function createAiRunner(deps: AiRunnerDeps): AiRunner {
  async function run<T>(task: AiTask<T>, models: readonly string[]): Promise<AiRunResult<T>> {
    const { transport } = deps;
    if (!transport) return { status: "unavailable" };
    // A malformed feature name is a defect in the caller, so it throws instead of hiding.
    if (!FEATURE_PATTERN.test(task.feature)) throw new Error("AI feature names must match ^[a-z_]{1,40}$");
    const estTokens = estimateInputTokens(task.system, task.input, task.schema);

    for (const model of models) {
      let id: number | null;
      try {
        id = await deps.reserve({
          lane: deps.lane,
          model,
          feature: task.feature,
          clinicId: task.clinicId,
          estTokens,
          clinicDailyCap: deps.clinicDailyCap,
        });
      } catch (error) {
        // Without a recorded reservation the call must not be sent, so the whole chain stops.
        reportError(error, { area: "ai.run", code: "reserve" });
        return { status: "unavailable" };
      }
      if (id === null) continue;

      const result = await attempt(transport, task, model);
      await settleOnce(deps, id, result);
      if (result.ok) return { status: "ok", value: result.value, model };
    }
    return { status: "unavailable" };
  }

  async function runWithEscalation<T>(task: AiTask<T>, chains: EscalationChains<T>): Promise<AiRunResult<T>> {
    const worker = await run(task, chains.worker);
    if (worker.status === "ok" && !chains.needsManager(worker.value)) return worker;
    const manager = await run(task, chains.manager);
    if (manager.status === "ok") return manager;
    // The worker's value when it produced one, otherwise unavailable.
    return worker;
  }

  return { run, runWithEscalation };
}

async function attempt<T>(transport: Transport, task: AiTask<T>, model: string): Promise<GenerateResult<T>> {
  try {
    return await transport.generate({
      model,
      system: task.system,
      input: task.input,
      schema: task.schema,
      parse: task.parse,
      thinkingLevel: task.thinkingLevel,
      temperature: task.temperature,
    });
  } catch (error) {
    // The transport returns failures as results, so a throw is a defect. It counts as a failed attempt.
    reportError(error, { area: "ai.run", code: "throw" });
    return { ok: false, reason: "failed" };
  }
}

/** A settle error is reported and does not lose the model's result: the caller still gets the answer. */
async function settleOnce<T>(deps: AiRunnerDeps, id: number, result: GenerateResult<T>): Promise<void> {
  const outcome = outcomeOf(result);
  try {
    await deps.settle(id, outcome.status, outcome.usage);
  } catch (error) {
    reportError(error, { area: "ai.run", code: "settle" });
  }
}

function outcomeOf<T>(result: GenerateResult<T>): { status: AiCallStatus; usage: AiUsage | null } {
  if (result.ok) return { status: "ok", usage: result.usage };
  switch (result.reason) {
    case "rate_limited":
      return { status: "rate_limited", usage: null };
    case "invalid_output":
      return { status: "invalid_output", usage: result.usage };
    case "failed":
      return { status: "failed", usage: null };
  }
}
