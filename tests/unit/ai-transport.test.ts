import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { z } from "zod";

import { reportError } from "@/lib/observability/report";
import { createGeminiTransport } from "@/server/ai/transport";
import type { GenerateRequest } from "@/server/ai/types";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

// Synthetic values built at runtime, so no literal looks like a Google key.
const API_KEY = "test" + "x".repeat(40);
const PROMPT = "SYSTEM-PROMPT-marker-7f3a";
const INPUT = "PATIENT-INPUT-marker-91bc";
const OUTPUT_MARKER = "MODEL-OUTPUT-marker-2d48";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const RETRY_INFO = "type.googleapis.com/google.rpc.RetryInfo";

const OUTPUT = z.object({ summary: z.string().max(160) });
const SCHEMA = {
  type: "object",
  properties: { summary: { type: "string", maxLength: 160 } },
  required: ["summary"],
};
const USAGE = { total_input_tokens: 120, total_output_tokens: 30, total_thought_tokens: 10 };

function request(): GenerateRequest<z.infer<typeof OUTPUT>> {
  return {
    model: "gemini-3.5-flash-lite",
    system: PROMPT,
    input: INPUT,
    schema: SCHEMA,
    parse: OUTPUT,
    thinkingLevel: "low",
    temperature: 0.2,
  };
}

/** A completed interaction. Pass null for usage to omit the usage object. */
function completed(text: string, usage: Record<string, unknown> | null = USAGE) {
  return {
    id: "int_1",
    model: "gemini-3.5-flash-lite",
    status: "completed",
    steps: [{ type: "model_output", content: [{ type: "text", text }] }],
    ...(usage ? { usage } : {}),
  };
}

function respond(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

function transportWith(fetchMock: typeof fetch, timeoutMs?: number) {
  return createGeminiTransport({ fetch: fetchMock, apiKey: API_KEY, timeoutMs });
}

function firstInit(mock: Mock<typeof fetch>): RequestInit {
  const call = mock.mock.calls[0];
  if (!call) throw new Error("expected a call");
  return call[1] ?? {};
}

/** Everything the reporter received, flattened to text, so leaks are visible. */
function reportedText(): string {
  return vi
    .mocked(reportError)
    .mock.calls.map(([error, context]) => {
      const { name, message } = error as Error;
      return JSON.stringify({ name, message, context });
    })
    .join("\n");
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createGeminiTransport request", () => {
  it("posts to the interactions endpoint with the key header and the pinned body", async () => {
    const fetchMock = respond(completed(JSON.stringify({ summary: "ok" })));
    await transportWith(fetchMock).generate(request());

    expect(fetchMock.mock.calls[0]?.[0]).toBe(ENDPOINT);
    const init = firstInit(fetchMock);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe(API_KEY);
    expect(headers["content-type"]).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init.body))).toEqual({
      model: "gemini-3.5-flash-lite",
      input: INPUT,
      system_instruction: PROMPT,
      generation_config: { thinking_level: "low", temperature: 0.2 },
      response_format: { type: "text", mime_type: "application/json", schema: SCHEMA },
      store: false,
    });
  });
});

describe("createGeminiTransport success", () => {
  it("returns the parsed value and the usage counts", async () => {
    const fetchMock = respond(completed(JSON.stringify({ summary: "Routine check-up." })));
    await expect(transportWith(fetchMock).generate(request())).resolves.toEqual({
      ok: true,
      value: { summary: "Routine check-up." },
      usage: { inputTokens: 120, outputTokens: 30, thoughtTokens: 10 },
    });
  });

  it("joins the text parts of every model_output step and ignores other steps", async () => {
    const body = {
      status: "completed",
      steps: [
        { type: "thought", content: [{ type: "text", text: "not output" }] },
        { type: "model_output", content: [{ type: "text", text: '{"summary":' }] },
        { type: "model_output", content: [{ type: "text", text: '"ok"}' }] },
      ],
      usage: USAGE,
    };
    const result = await transportWith(respond(body)).generate(request());
    expect(result).toMatchObject({ ok: true, value: { summary: "ok" } });
  });

  it("reports usage null when the response has no usage object", async () => {
    const result = await transportWith(respond(completed(JSON.stringify({ summary: "ok" }), null))).generate(request());
    expect(result).toMatchObject({ ok: true, usage: null });
  });

  it("counts a missing usage field as zero", async () => {
    const result = await transportWith(respond(completed(JSON.stringify({ summary: "ok" }), { total_input_tokens: 5 }))).generate(
      request(),
    );
    expect(result).toMatchObject({ ok: true, usage: { inputTokens: 5, outputTokens: 0, thoughtTokens: 0 } });
  });
});

describe("createGeminiTransport invalid output", () => {
  it("treats a status other than completed as invalid_output", async () => {
    const body = { ...completed(JSON.stringify({ summary: "ok" })), status: "in_progress" };
    await expect(transportWith(respond(body)).generate(request())).resolves.toEqual({
      ok: false,
      reason: "invalid_output",
      usage: { inputTokens: 120, outputTokens: 30, thoughtTokens: 10 },
    });
  });

  it("treats a response with no model_output step as invalid_output", async () => {
    const body = { status: "completed", steps: [{ type: "thought", content: [] }], usage: USAGE };
    await expect(transportWith(respond(body)).generate(request())).resolves.toMatchObject({ ok: false, reason: "invalid_output" });
  });

  it("treats malformed JSON text as invalid_output, with usage", async () => {
    const text = `{"summary": "${OUTPUT_MARKER}`;
    await expect(transportWith(respond(completed(text))).generate(request())).resolves.toEqual({
      ok: false,
      reason: "invalid_output",
      usage: { inputTokens: 120, outputTokens: 30, thoughtTokens: 10 },
    });
  });

  it("treats a Zod failure as invalid_output, with usage", async () => {
    await expect(transportWith(respond(completed(JSON.stringify({ summary: 42 })))).generate(request())).resolves.toMatchObject({
      ok: false,
      reason: "invalid_output",
      usage: { inputTokens: 120 },
    });
  });

  it("treats a success response that is not JSON as invalid_output, with null usage", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("<html>gateway</html>", { status: 200 }));
    await expect(transportWith(fetchMock).generate(request())).resolves.toEqual({ ok: false, reason: "invalid_output", usage: null });
  });
});

describe("createGeminiTransport rate limits", () => {
  it("returns retryAfterMs from the RetryInfo delay", async () => {
    const body = {
      error: {
        code: 429,
        status: "RESOURCE_EXHAUSTED",
        message: "quota exceeded",
        details: [{ "@type": RETRY_INFO, retryDelay: "23s" }],
      },
    };
    await expect(transportWith(respond(body, 429)).generate(request())).resolves.toEqual({
      ok: false,
      reason: "rate_limited",
      retryAfterMs: 23_000,
    });
    // A 429 is the expected answer at the limit, not an error to report.
    expect(reportError).not.toHaveBeenCalled();
  });

  it("returns null when a 429 has no details", async () => {
    const body = { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "quota exceeded" } };
    await expect(transportWith(respond(body, 429)).generate(request())).resolves.toEqual({
      ok: false,
      reason: "rate_limited",
      retryAfterMs: null,
    });
  });

  it("returns null when a 429 body is not JSON", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("slow down", { status: 429 }));
    await expect(transportWith(fetchMock).generate(request())).resolves.toEqual({
      ok: false,
      reason: "rate_limited",
      retryAfterMs: null,
    });
  });
});

describe("createGeminiTransport failures", () => {
  it("treats a 500 as failed", async () => {
    await expect(transportWith(respond({ error: { code: 500 } }, 500)).generate(request())).resolves.toEqual({
      ok: false,
      reason: "failed",
    });
  });

  it("treats a thrown fetch error as failed", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new TypeError("socket hang up");
    });
    await expect(transportWith(fetchMock).generate(request())).resolves.toEqual({ ok: false, reason: "failed" });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "ai.transport", code: "network" });
  });

  it("aborts a call that outlives the timeout and treats it as failed", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener("abort", () => reject(signal.reason));
        }),
    );
    await expect(transportWith(fetchMock, 5).generate(request())).resolves.toEqual({ ok: false, reason: "failed" });
    expect(firstInit(fetchMock).signal).toBeInstanceOf(AbortSignal);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "ai.transport", code: "timeout" });
  });
});

describe("createGeminiTransport reporting", () => {
  it("reports each failure with a code only, never the prompt, the input or the output", async () => {
    const logSpy = vi.spyOn(console, "log");
    const failing = [
      // A 500 whose body echoes the input.
      transportWith(respond({ error: { message: `could not process ${INPUT}` } }, 500)),
      // A network error whose message carries the prompt and the input.
      transportWith(
        vi.fn<typeof fetch>(async () => {
          throw new TypeError(`request failed for ${PROMPT} ${INPUT}`);
        }),
      ),
      // Malformed JSON that contains the output text.
      transportWith(respond(completed(`{"summary": "${OUTPUT_MARKER}`))),
      // A Zod failure (summary is not text) whose output text is echoed in the response.
      transportWith(respond(completed(JSON.stringify({ summary: 42, note: OUTPUT_MARKER, extra: INPUT })))),
      // A 429 whose message echoes the input.
      transportWith(respond({ error: { code: 429, message: INPUT } }, 429)),
    ];
    for (const transport of failing) {
      await transport.generate(request());
    }

    // Every failure but the 429 is reported; a 429 is expected at the limit and only logged in ai_calls.
    expect(reportError).toHaveBeenCalledTimes(failing.length - 1);
    for (const [error, context] of vi.mocked(reportError).mock.calls) {
      expect((error as Error).message).toMatch(/^ai_(failed|invalid_output)$/);
      expect(Object.keys(context)).toEqual(["area", "code"]);
      expect(context.area).toBe("ai.transport");
      expect(context.code).toMatch(/^(\d{3}|network|timeout|invalid_output)$/);
    }
    const reported = reportedText();
    for (const secret of [PROMPT, INPUT, OUTPUT_MARKER, API_KEY]) {
      expect(reported).not.toContain(secret);
    }
    expect(logSpy).not.toHaveBeenCalled();
  });
});
