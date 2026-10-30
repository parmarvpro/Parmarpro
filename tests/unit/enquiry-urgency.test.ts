import { describe, expect, it } from "vitest";

import { keywordUrgency, raiseUrgency } from "@/lib/enquiry-urgency";

describe("keywordUrgency", () => {
  it.each([
    "pain", "painful", "ache", "toothache", "swelling", "swollen", "bleeding", "blood", "broken", "cracked",
    "knocked out", "accident", "abscess", "pus", "fever", "can't eat", "cannot sleep", "emergency", "urgent",
    "dard", "dukh", "dukhta", "sujan", "soojan", "khoon", "toot", "tuta",
  ])("flags the word %s", (word) => {
    expect(keywordUrgency(`I have ${word} since morning`)).toBe("call_today");
  });

  it("is case-insensitive", () => {
    expect(keywordUrgency("PAIN in the lower jaw")).toBe("call_today");
    expect(keywordUrgency("Toothache at night")).toBe("call_today");
  });

  it("matches phrases with any spacing and with a curly apostrophe", () => {
    expect(keywordUrgency("my front tooth got knocked  out")).toBe("call_today");
    expect(keywordUrgency("I can’t eat anything")).toBe("call_today");
  });

  it("matches whole words only", () => {
    expect(keywordUrgency("painless check-up")).toBe(null);
    expect(keywordUrgency("painting my walls")).toBe(null);
    expect(keywordUrgency("my toothbrush is old")).toBe(null);
    expect(keywordUrgency("pushed the date")).toBe(null);
  });

  it("returns null for a routine enquiry", () => {
    expect(keywordUrgency("I would like a cleaning next week")).toBe(null);
    expect(keywordUrgency("")).toBe(null);
  });
});

describe("raiseUrgency: a keyword can only raise the model's urgency", () => {
  it("takes the keyword's call_today over a routine or soon answer", () => {
    expect(raiseUrgency("routine", "call_today")).toBe("call_today");
    expect(raiseUrgency("soon", "call_today")).toBe("call_today");
  });

  it("keeps the model's answer when there is no keyword", () => {
    expect(raiseUrgency("routine", null)).toBe("routine");
    expect(raiseUrgency("soon", null)).toBe("soon");
    expect(raiseUrgency("call_today", null)).toBe("call_today");
  });

  it("never lowers the model's answer", () => {
    expect(raiseUrgency("call_today", "soon")).toBe("call_today");
    expect(raiseUrgency("call_today", "routine")).toBe("call_today");
    expect(raiseUrgency("soon", "routine")).toBe("soon");
  });
});
