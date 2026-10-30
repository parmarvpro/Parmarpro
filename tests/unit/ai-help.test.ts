import { describe, expect, it } from "vitest";

import { AI_NEVER_SENT, AI_PROMPTS, aiHelpState } from "@/lib/ai-help";

describe("aiHelpState", () => {
  it("is off whenever the clinic has not turned AI help on, whether or not the service is connected", () => {
    expect(aiHelpState({ enabled: false, configured: false })).toBe("off");
    expect(aiHelpState({ enabled: false, configured: true })).toBe("off");
  });

  it("is not connected when it is on but the Gemini service is not set up, so nothing runs", () => {
    expect(aiHelpState({ enabled: true, configured: false })).toBe("not_connected");
  });

  it("is on only when the clinic has it on and the service is connected", () => {
    expect(aiHelpState({ enabled: true, configured: true })).toBe("on");
  });
});

describe("AI help copy", () => {
  it("lists the two clinic prompts, and nothing else", () => {
    expect(AI_PROMPTS.map((prompt) => prompt.id)).toEqual(["sort", "draft"]);
  });

  it("says what each prompt receives and returns, and who can run it", () => {
    for (const prompt of AI_PROMPTS) {
      expect(prompt.where.length).toBeGreaterThan(0);
      expect(prompt.receives.length).toBeGreaterThan(0);
      expect(prompt.returns.length).toBeGreaterThan(0);
      expect(prompt.runBy).toMatch(/owners, admins and staff/i);
    }
  });

  it("states that the name, phone number and email are never sent", () => {
    expect(AI_NEVER_SENT.join(" ")).toMatch(/name, phone number and email/);
  });
});
