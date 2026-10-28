import { describe, expect, it } from "vitest";

import { FLOW_DIRECTIONS } from "@/lib/motion/counter-flow";
import { FRAGMENT_SOURCE } from "@/lib/motion/dither-shader";

describe("dither shader source", () => {
  it("declares every uniform the renderer sets", () => {
    for (const name of [
      "uTime",
      "uResolution",
      "uPxScale",
      "uCell",
      "uGutter",
      "uRadius",
      "uOffset",
      "uSpeed",
      "uDir",
      "uScrollPhase",
      "uPointer",
      "uBlueBase",
      "uBlueLow",
      "uBlueMid",
      "uBlueHigh",
      "uPaperBase",
      "uPaperLow",
      "uPaperMid",
      "uPaperHigh",
    ]) {
      expect(FRAGMENT_SOURCE).toContain(`uniform`);
      expect(FRAGMENT_SOURCE).toMatch(new RegExp(`uniform\\s+\\w+\\s+${name};`));
    }
  });

  it("takes each panel's direction from the shared uniform, left → uDir.x, middle → uDir.y, right → uDir.z", () => {
    expect(FRAGMENT_SOURCE).toContain("panel < 0.5 ? uDir.x : (panel < 1.5 ? uDir.y : uDir.z)");
  });

  it("applies the same direction sign to time and to scroll, so scroll never breaks the counter-flow", () => {
    expect(FRAGMENT_SOURCE).toContain("float flow = (uTime * uSpeed + uScrollPhase) * dir;");
  });

  it("marks only the middle panel as the inverted tone", () => {
    expect(FRAGMENT_SOURCE).toContain("float mid = step(0.5, panel) - step(1.5, panel);");
  });

  it("keeps the shared direction rule in the shape the shader expects", () => {
    expect(FLOW_DIRECTIONS).toHaveLength(3);
    expect(FLOW_DIRECTIONS[1]).toBe(-FLOW_DIRECTIONS[0]);
    expect(FLOW_DIRECTIONS[2]).toBe(FLOW_DIRECTIONS[0]);
  });
});
