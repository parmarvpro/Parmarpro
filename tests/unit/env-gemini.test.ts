import { afterEach, describe, expect, it, vi } from "vitest";

import { geminiFreeEnv, geminiPaidEnv, isConfigured, MissingConfigurationError } from "@/lib/env";

// Synthetic values built at runtime. Not real keys.
const VALID_KEY = "test" + "x".repeat(40);
const SHORT_KEY = "x".repeat(25); // 25 characters, under the 30 minimum

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each([
  { name: "geminiFreeEnv", variable: "GEMINI_FREE_API_KEY", loader: geminiFreeEnv },
  { name: "geminiPaidEnv", variable: "GEMINI_PAID_API_KEY", loader: geminiPaidEnv },
])("$name", ({ variable, loader }) => {
  it("returns the key when it has at least 30 characters", () => {
    vi.stubEnv(variable, VALID_KEY);
    expect(loader()).toEqual({ [variable]: VALID_KEY });
    expect(isConfigured(loader)).toBe(true);
  });

  it("is not configured when the variable is empty", () => {
    vi.stubEnv(variable, "");
    expect(() => loader()).toThrow(MissingConfigurationError);
    expect(isConfigured(loader)).toBe(false);
  });

  it("rejects a short key, naming only the variable and never its value", () => {
    vi.stubEnv(variable, SHORT_KEY);
    let caught: unknown;
    try {
      loader();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(MissingConfigurationError);
    const message = (caught as Error).message;
    expect(message).toContain(variable);
    expect(message).not.toContain(SHORT_KEY);
    expect(isConfigured(loader)).toBe(false);
  });
});
