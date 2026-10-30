import "server-only";

import type { ZodType } from "zod";

import { reportError } from "@/lib/observability/report";
import type { AiUsage, GenerateRequest, GenerateResult, Transport } from "@/server/ai/types";

/**
 * Gemini Interactions API: one request, one JSON answer, no streaming. Failures are
 * returned as results, never thrown. Nothing here logs or reports the prompt, the
 * input, the output or a response body, because Google can echo input in its errors.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const RETRY_INFO_TYPE = "type.googleapis.com/google.rpc.RetryInfo";
const DEFAULT_TIMEOUT_MS = 20_000;
const AREA = "ai.transport";

export function createGeminiTransport(deps: { fetch: typeof fetch; apiKey: string; timeoutMs?: number }): Transport {
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return {
    async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
      const http = await post(deps.fetch, deps.apiKey, timeoutMs, {
        model: req.model,
        input: req.input,
        system_instruction: req.system,
        generation_config: { thinking_level: req.thinkingLevel, temperature: req.temperature },
        response_format: { type: "text", mime_type: "application/json", schema: req.schema },
        // Google keeps no stored copy of the interaction when this is false.
        store: false,
      });
      if (!http.ok) return failed(http.code);
      if (http.status === 429) {
        // Not reported: a 429 is the expected answer at the limit. ai_calls records it and
        // the runner moves on to the next model.
        const retryAfterMs = retryDelayMs(parseJson(http.text));
        return { ok: false, reason: "rate_limited", retryAfterMs };
      }
      if (http.status < 200 || http.status > 299) return failed(String(http.status));
      return readOutput(http.text, req.parse);
    },
  };
}

type HttpResult = { ok: true; status: number; text: string } | { ok: false; code: "network" | "timeout" };

async function post(fetchImpl: typeof fetch, apiKey: string, timeoutMs: number, body: unknown): Promise<HttpResult> {
  const payload = JSON.stringify(body);
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
      body: payload,
      signal: AbortSignal.timeout(timeoutMs),
    });
    // The body is read inside the try so a timeout while reading it is a failure too.
    return { ok: true, status: response.status, text: await response.text() };
  } catch (error) {
    // The thrown error is not forwarded: its message can echo request details.
    return { ok: false, code: isTimeout(error) ? "timeout" : "network" };
  }
}

function readOutput<T>(text: string, parse: ZodType<T>): GenerateResult<T> {
  const body = parseJson(text);
  if (!isRecord(body)) return invalid(null);
  const usage = readUsage(body);
  const output = body.status === "completed" ? modelOutputText(body) : null;
  if (output === null) return invalid(usage);
  let json: unknown;
  try {
    json = JSON.parse(output);
  } catch {
    return invalid(usage);
  }
  const parsed = parse.safeParse(json);
  if (!parsed.success) return invalid(usage);
  return { ok: true, value: parsed.data, usage };
}

/** The text of every model_output step, concatenated. Null when there is no such step. */
function modelOutputText(body: Record<string, unknown>): string | null {
  const steps = Array.isArray(body.steps) ? body.steps : [];
  const outputs = steps.filter(isRecord).filter((step) => step.type === "model_output");
  if (outputs.length === 0) return null;
  let text = "";
  for (const step of outputs) {
    const parts = Array.isArray(step.content) ? step.content : [];
    for (const part of parts) {
      if (isRecord(part) && part.type === "text" && typeof part.text === "string") text += part.text;
    }
  }
  return text;
}

function readUsage(body: Record<string, unknown>): AiUsage | null {
  const usage = body.usage;
  if (!isRecord(usage)) return null;
  return {
    inputTokens: tokenCount(usage.total_input_tokens),
    outputTokens: tokenCount(usage.total_output_tokens),
    thoughtTokens: tokenCount(usage.total_thought_tokens),
  };
}

function tokenCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

/** The RetryInfo delay in milliseconds, from a string such as "23s". Null when absent. */
function retryDelayMs(body: unknown): number | null {
  if (!isRecord(body) || !isRecord(body.error) || !Array.isArray(body.error.details)) return null;
  for (const detail of body.error.details) {
    if (!isRecord(detail) || detail["@type"] !== RETRY_INFO_TYPE || typeof detail.retryDelay !== "string") continue;
    const match = /^(\d+(?:\.\d+)?)s$/.exec(detail.retryDelay);
    if (match?.[1]) return Math.round(Number(match[1]) * 1000);
  }
  return null;
}

function failed(code: string): { ok: false; reason: "failed" } {
  report("ai_failed", code);
  return { ok: false, reason: "failed" };
}

function invalid(usage: AiUsage | null): { ok: false; reason: "invalid_output"; usage: AiUsage | null } {
  report("ai_invalid_output", "invalid_output");
  return { ok: false, reason: "invalid_output", usage };
}

function report(message: string, code: string): void {
  reportError(new Error(message), { area: AREA, code });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}
