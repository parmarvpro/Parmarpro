import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { z } from "zod";

// The lanes are wired here with the real env loaders, transport and runner. The privileged
// call log and the global fetch are replaced, so the test shows which key, host and cap each
// lane uses, without a database or a network call.
const { reserve, settle } = vi.hoisted(() => ({ reserve: vi.fn(), settle: vi.fn() }));

vi.mock("@/server/privileged/ai-usage", () => ({ reserveAiCall: reserve, settleAiCall: settle }));
vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

// Synthetic values built at runtime. Not real keys.
const FREE_KEY = "test" + "f".repeat(40);
const PAID_KEY = "test" + "p".repeat(40);
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODEL = "gemini-3.5-flash-lite";

const TASK = {
  feature: "ops_note",
  clinicId: null,
  system: "Summarise the note.",
  input: "Operational note.",
  schema: { type: "object" },
  parse: z.object({ summary: z.string() }),
  thinkingLevel: "minimal" as const,
  temperature: 0,
};

function serve(): Mock<typeof fetch> {
  const body = {
    status: "completed",
    steps: [{ type: "model_output", content: [{ type: "text", text: JSON.stringify({ summary: "ok" }) }] }],
    usage: { total_input_tokens: 5, total_output_tokens: 2, total_thought_tokens: 0 },
  };
  const fetchMock = vi.fn<typeof fetch>(async () => Response.json(body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.resetModules();
  reserve.mockReset();
  reserve.mockResolvedValue(1);
  settle.mockReset();
  settle.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("freeLane", () => {
  it("sends with the free key, records the free lane, and has no clinic cap", async () => {
    vi.stubEnv("GEMINI_FREE_API_KEY", FREE_KEY);
    vi.stubEnv("GEMINI_PAID_API_KEY", PAID_KEY);
    const fetchMock = serve();
    const { freeLane } = await import("@/server/ai/free-lane");

    await expect(freeLane().run(TASK, [MODEL])).resolves.toEqual({ status: "ok", value: { summary: "ok" }, model: MODEL });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(ENDPOINT);
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe(FREE_KEY);
    expect(reserve).toHaveBeenCalledWith(expect.objectContaining({ lane: "free", model: MODEL, clinicDailyCap: null }));
    expect(settle).toHaveBeenCalledWith(1, "ok", { inputTokens: 5, outputTokens: 2, thoughtTokens: 0 });
  });

  it("is unavailable, with nothing reserved or sent, when its key is missing", async () => {
    vi.stubEnv("GEMINI_FREE_API_KEY", "");
    vi.stubEnv("GEMINI_PAID_API_KEY", PAID_KEY);
    const fetchMock = serve();
    const { freeLane } = await import("@/server/ai/free-lane");

    await expect(freeLane().run(TASK, [MODEL])).resolves.toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
  });
});

describe("paidLane", () => {
  it("sends with the paid key, records the paid lane, and caps each clinic", async () => {
    vi.stubEnv("GEMINI_FREE_API_KEY", FREE_KEY);
    vi.stubEnv("GEMINI_PAID_API_KEY", PAID_KEY);
    const fetchMock = serve();
    const { paidLane } = await import("@/server/ai/paid-lane");
    const clinicId = "00000000-0000-4000-8000-000000000001";

    await expect(paidLane().run({ ...TASK, clinicId }, [MODEL])).resolves.toMatchObject({ status: "ok", model: MODEL });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init?.headers as Record<string, string>)["x-goog-api-key"]).toBe(PAID_KEY);
    expect(reserve).toHaveBeenCalledWith(expect.objectContaining({ lane: "paid", clinicId, clinicDailyCap: 100 }));
  });

  it("is unavailable, with nothing reserved or sent, when its key is missing", async () => {
    vi.stubEnv("GEMINI_FREE_API_KEY", FREE_KEY);
    vi.stubEnv("GEMINI_PAID_API_KEY", "");
    const fetchMock = serve();
    const { paidLane } = await import("@/server/ai/paid-lane");

    await expect(paidLane().run(TASK, [MODEL])).resolves.toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
  });
});
