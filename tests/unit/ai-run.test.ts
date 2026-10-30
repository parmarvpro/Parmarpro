import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { reportError } from "@/lib/observability/report";
import { estimateInputTokens } from "@/server/ai/models";
import { createAiRunner, type AiRunnerDeps, type AiTask } from "@/server/ai/run";
import type { AiUsage, GenerateRequest, GenerateResult, Transport } from "@/server/ai/types";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

const OUTPUT = z.object({ summary: z.string() });
type Output = z.infer<typeof OUTPUT>;

const SCHEMA = { type: "object", properties: { summary: { type: "string", maxLength: 160 } } };
const CLINIC_ID = "00000000-0000-4000-8000-000000000001";
const USAGE: AiUsage = { inputTokens: 120, outputTokens: 30, thoughtTokens: 10 };

const TASK: AiTask<Output> = {
  feature: "enquiry_sort",
  clinicId: CLINIC_ID,
  system: "Sort the enquiry.",
  input: "Asks about a check-up on weekday mornings.",
  schema: SCHEMA,
  parse: OUTPUT,
  thinkingLevel: "minimal",
  temperature: 0,
};

type Outcome =
  | { kind: "ok"; summary: string; usage: AiUsage | null }
  | { kind: "rate_limited" }
  | { kind: "invalid_output"; usage: AiUsage | null }
  | { kind: "failed" }
  | { kind: "throw" };

const ok = (summary = "Routine check-up.", usage: AiUsage | null = USAGE): Outcome => ({ kind: "ok", summary, usage });

/** A transport that answers each model from its outcome. A model without one fails. */
function fakeTransport(outcomes: Record<string, Outcome>) {
  const models: string[] = [];
  const transport: Transport = {
    async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
      models.push(req.model);
      const outcome: Outcome = outcomes[req.model] ?? { kind: "failed" };
      switch (outcome.kind) {
        case "ok":
          return { ok: true, value: req.parse.parse({ summary: outcome.summary }), usage: outcome.usage };
        case "rate_limited":
          return { ok: false, reason: "rate_limited", retryAfterMs: null };
        case "invalid_output":
          return { ok: false, reason: "invalid_output", usage: outcome.usage };
        case "failed":
          return { ok: false, reason: "failed" };
        case "throw":
          throw new Error("defect");
      }
    },
  };
  return { transport, models };
}

type HarnessOptions = {
  outcomes?: Record<string, Outcome>;
  noTransport?: boolean;
  refuse?: string[];
  reserveThrows?: boolean;
  settleThrows?: boolean;
  clinicDailyCap?: number | null;
};

function harness(options: HarnessOptions = {}) {
  const fake = fakeTransport(options.outcomes ?? {});
  let nextId = 0;
  const reserve = vi.fn<AiRunnerDeps["reserve"]>(async (params) => {
    if (options.reserveThrows) throw new Error("database down");
    if (options.refuse?.includes(params.model)) return null;
    nextId += 1;
    return nextId;
  });
  const settle = vi.fn<AiRunnerDeps["settle"]>(async () => {
    if (options.settleThrows) throw new Error("settle failed");
  });
  const runner = createAiRunner({
    lane: "free",
    transport: options.noTransport ? null : fake.transport,
    reserve,
    settle,
    clinicDailyCap: options.clinicDailyCap ?? null,
  });
  return { runner, reserve, settle, models: fake.models };
}

function reservedModels(reserve: ReturnType<typeof harness>["reserve"]): string[] {
  return reserve.mock.calls.map(([params]) => params.model);
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

describe("run without a transport", () => {
  it("is unavailable and reserves nothing when the lane has no key", async () => {
    const h = harness({ noTransport: true });
    await expect(h.runner.run(TASK, ["gemini-3.5-flash-lite"])).resolves.toEqual({ status: "unavailable" });
    expect(h.reserve).not.toHaveBeenCalled();
    expect(h.settle).not.toHaveBeenCalled();
  });

  it("is unavailable without a key even for a malformed feature name, since nothing is sent", async () => {
    const h = harness({ noTransport: true });
    await expect(h.runner.run({ ...TASK, feature: "Enquiry-Sort" }, ["m-1"])).resolves.toEqual({ status: "unavailable" });
    expect(h.reserve).not.toHaveBeenCalled();
  });
});

describe("run", () => {
  it("reserves with the estimate and the cap, sends, and settles the answer once as ok", async () => {
    const h = harness({ outcomes: { "m-1": ok() }, clinicDailyCap: 100 });
    await expect(h.runner.run(TASK, ["m-1"])).resolves.toEqual({ status: "ok", value: { summary: "Routine check-up." }, model: "m-1" });

    const expectedEstimate = estimateInputTokens(TASK.system, TASK.input, TASK.schema);
    expect(h.reserve).toHaveBeenCalledTimes(1);
    expect(h.reserve).toHaveBeenCalledWith({
      lane: "free",
      model: "m-1",
      feature: "enquiry_sort",
      clinicId: CLINIC_ID,
      estTokens: expectedEstimate,
      clinicDailyCap: 100,
    });
    expect(h.settle).toHaveBeenCalledTimes(1);
    expect(h.settle).toHaveBeenCalledWith(1, "ok", USAGE);
  });

  it("estimates input tokens at three characters per token, rounded up", async () => {
    // system (3) + input (2) + the JSON of {} (2) = 7 characters, so ceil(7 / 3) = 3.
    const h = harness({ outcomes: { "m-1": ok() } });
    await h.runner.run({ ...TASK, system: "abc", input: "de", schema: {} }, ["m-1"]);
    expect(h.reserve).toHaveBeenCalledWith(expect.objectContaining({ estTokens: 3 }));
  });

  it("falls back to the next model when a reservation is refused, settling only the model that ran", async () => {
    const h = harness({ outcomes: { "m-2": ok() }, refuse: ["m-1"] });
    await expect(h.runner.run(TASK, ["m-1", "m-2"])).resolves.toMatchObject({ status: "ok", model: "m-2" });
    expect(reservedModels(h.reserve)).toEqual(["m-1", "m-2"]);
    expect(h.models).toEqual(["m-2"]);
    expect(h.settle).toHaveBeenCalledTimes(1);
  });

  it("falls back when a model is rate limited, settling it as rate_limited with no usage", async () => {
    const h = harness({ outcomes: { "m-1": { kind: "rate_limited" }, "m-2": ok() } });
    await expect(h.runner.run(TASK, ["m-1", "m-2"])).resolves.toMatchObject({ status: "ok", model: "m-2" });
    expect(h.settle).toHaveBeenNthCalledWith(1, 1, "rate_limited", null);
    expect(h.settle).toHaveBeenNthCalledWith(2, 2, "ok", USAGE);
  });

  it("falls back when a model returns invalid output, settling it with the usage it reported", async () => {
    const h = harness({ outcomes: { "m-1": { kind: "invalid_output", usage: USAGE }, "m-2": ok() } });
    await expect(h.runner.run(TASK, ["m-1", "m-2"])).resolves.toMatchObject({ status: "ok", model: "m-2" });
    expect(h.settle).toHaveBeenNthCalledWith(1, 1, "invalid_output", USAGE);
  });

  it("falls back when a model fails, settling it as failed with no usage", async () => {
    const h = harness({ outcomes: { "m-2": ok() } });
    await expect(h.runner.run(TASK, ["m-1", "m-2"])).resolves.toMatchObject({ status: "ok", model: "m-2" });
    expect(h.settle).toHaveBeenNthCalledWith(1, 1, "failed", null);
  });

  it("treats a throwing transport as a failed attempt and reports the defect by code", async () => {
    const h = harness({ outcomes: { "m-1": { kind: "throw" }, "m-2": ok() } });
    await expect(h.runner.run(TASK, ["m-1", "m-2"])).resolves.toMatchObject({ status: "ok", model: "m-2" });
    expect(h.settle).toHaveBeenNthCalledWith(1, 1, "failed", null);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "ai.run", code: "throw" });
  });

  it("is unavailable when every model is refused or fails", async () => {
    const h = harness({ outcomes: { "m-2": { kind: "rate_limited" } }, refuse: ["m-1"] });
    await expect(h.runner.run(TASK, ["m-1", "m-2", "m-3"])).resolves.toEqual({ status: "unavailable" });
    // m-1 was refused, so nothing was sent for it. m-2 and m-3 were sent and settled.
    expect(h.settle).toHaveBeenNthCalledWith(1, 1, "rate_limited", null);
    expect(h.settle).toHaveBeenNthCalledWith(2, 2, "failed", null);
    expect(h.models).toEqual(["m-2", "m-3"]);
  });

  it("is unavailable and sends nothing when the reservation itself throws", async () => {
    const h = harness({ outcomes: { "m-1": ok() }, reserveThrows: true });
    await expect(h.runner.run(TASK, ["m-1", "m-2"])).resolves.toEqual({ status: "unavailable" });
    expect(h.models).toEqual([]);
    expect(h.settle).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "ai.run", code: "reserve" });
  });

  it("keeps the answer when settling throws, and reports the settle error by code", async () => {
    const h = harness({ outcomes: { "m-1": ok() }, settleThrows: true });
    await expect(h.runner.run(TASK, ["m-1"])).resolves.toEqual({ status: "ok", value: { summary: "Routine check-up." }, model: "m-1" });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "ai.run", code: "settle" });
  });

  it("rejects a feature name outside the allowed pattern before reserving anything", async () => {
    const h = harness({ outcomes: { "m-1": ok() } });
    await expect(h.runner.run({ ...TASK, feature: "Enquiry-Sort" }, ["m-1"])).rejects.toThrow(/feature/);
    expect(h.reserve).not.toHaveBeenCalled();
  });
});

describe("runWithEscalation", () => {
  const CHAINS = { worker: ["w-1"], manager: ["m-1"] };

  it("keeps the worker's value and never runs the manager when the value is accepted", async () => {
    const h = harness({ outcomes: { "w-1": ok("Worker answer.") } });
    const result = await h.runner.runWithEscalation(TASK, { ...CHAINS, needsManager: () => false });
    expect(result).toEqual({ status: "ok", value: { summary: "Worker answer." }, model: "w-1" });
    expect(reservedModels(h.reserve)).toEqual(["w-1"]);
  });

  it("runs the manager when the worker is unavailable", async () => {
    const h = harness({ outcomes: { "m-1": ok("Manager answer.") }, refuse: ["w-1"] });
    const result = await h.runner.runWithEscalation(TASK, { ...CHAINS, needsManager: () => false });
    expect(result).toEqual({ status: "ok", value: { summary: "Manager answer." }, model: "m-1" });
  });

  it("runs the manager when needsManager is true, and returns the manager's value", async () => {
    const h = harness({ outcomes: { "w-1": ok("Unsure."), "m-1": ok("Manager answer.") } });
    const needsManager = vi.fn((value: Output) => value.summary === "Unsure.");
    const result = await h.runner.runWithEscalation(TASK, { ...CHAINS, needsManager });
    expect(needsManager).toHaveBeenCalledWith({ summary: "Unsure." });
    expect(result).toEqual({ status: "ok", value: { summary: "Manager answer." }, model: "m-1" });
  });

  it("returns the worker's value when needsManager is true but the manager is unavailable", async () => {
    const h = harness({ outcomes: { "w-1": ok("Unsure.") }, refuse: ["m-1"] });
    const result = await h.runner.runWithEscalation(TASK, { ...CHAINS, needsManager: () => true });
    expect(result).toEqual({ status: "ok", value: { summary: "Unsure." }, model: "w-1" });
  });

  it("runs the manager once, even when it fails, and returns unavailable when nothing answers", async () => {
    const h = harness({ refuse: ["w-1"] });
    const result = await h.runner.runWithEscalation(TASK, { ...CHAINS, needsManager: () => false });
    expect(result).toEqual({ status: "unavailable" });
    expect(reservedModels(h.reserve).filter((model) => model === "m-1")).toHaveLength(1);
    expect(h.models).toEqual(["m-1"]);
  });

  it("runs the manager once when the worker fails and the manager also fails", async () => {
    const h = harness({ outcomes: { "w-1": { kind: "failed" }, "m-1": { kind: "failed" } } });
    await expect(h.runner.runWithEscalation(TASK, { ...CHAINS, needsManager: () => false })).resolves.toEqual({
      status: "unavailable",
    });
    expect(h.models).toEqual(["w-1", "m-1"]);
  });

  it("is unavailable without a transport, and reserves nothing", async () => {
    const h = harness({ noTransport: true });
    await expect(h.runner.runWithEscalation(TASK, { ...CHAINS, needsManager: () => true })).resolves.toEqual({ status: "unavailable" });
    expect(h.reserve).not.toHaveBeenCalled();
  });
});
