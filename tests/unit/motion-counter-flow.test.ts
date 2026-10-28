import { describe, expect, it } from "vitest";

import {
  columnAnimationDirection,
  FIELD_COLORS,
  FLOW_DIRECTIONS,
  flowDirection,
  hexToRgb01,
  panelAtX,
  panelLayout,
  panelTone,
  parallaxYPercent,
  stepCardOffset,
  type PanelIndex,
} from "@/lib/motion/counter-flow";

const PANELS: PanelIndex[] = [0, 1, 2];

describe("counter-flow direction rule", () => {
  it("outer panels move together and the middle moves the exact opposite way", () => {
    expect(flowDirection(0)).toBe(flowDirection(2));
    expect(flowDirection(1)).toBe(-flowDirection(0));
    expect(FLOW_DIRECTIONS).toEqual([1, -1, 1]);
  });

  it("card columns: outer share a direction, the middle is reversed", () => {
    expect(columnAnimationDirection(0)).toBe("normal");
    expect(columnAnimationDirection(2)).toBe("normal");
    expect(columnAnimationDirection(1)).toBe("reverse");
  });

  it("tones invert in the middle panel", () => {
    expect(panelTone(0)).toBe("blue");
    expect(panelTone(1)).toBe("paper");
    expect(panelTone(2)).toBe("blue");
  });

  it.each([0, 0.25, 0.5, 0.75, 1])("scroll parallax at progress %s: outer equal, middle mirrored", (progress) => {
    const [a, b, c] = PANELS.map((panel) => parallaxYPercent(panel, progress));
    expect(a).toBeCloseTo(c!, 10);
    expect(b).toBeCloseTo(-a!, 10);
  });

  it("parallax runs −6 → +6 for the outer panels and +6 → −6 for the middle", () => {
    expect(parallaxYPercent(0, 0)).toBe(-6);
    expect(parallaxYPercent(0, 1)).toBe(6);
    expect(parallaxYPercent(1, 0)).toBe(6);
    expect(parallaxYPercent(1, 1)).toBe(-6);
  });

  it("step cards cross over and align at the centre of the scroll range", () => {
    expect(stepCardOffset(0, 0)).toBe(48);
    expect(stepCardOffset(0, 1)).toBe(-48);
    expect(stepCardOffset(1, 0)).toBe(-48);
    expect(stepCardOffset(1, 1)).toBe(48);
    for (const panel of PANELS) expect(Math.abs(stepCardOffset(panel, 0.5))).toBe(0);
  });

  it("clamps progress outside 0..1", () => {
    expect(parallaxYPercent(0, -3)).toBe(parallaxYPercent(0, 0));
    expect(parallaxYPercent(0, 9)).toBe(parallaxYPercent(0, 1));
    expect(stepCardOffset(2, 4)).toBe(stepCardOffset(2, 1));
  });
});

describe("panel layout (CPU mirror of the shader)", () => {
  it("three equal panels separated by two gutters fill the width exactly", () => {
    const [a, b, c] = panelLayout(1000, 16);
    expect(a.width).toBeCloseTo(b.width, 10);
    expect(b.width).toBeCloseTo(c.width, 10);
    expect(c.x + c.width).toBeCloseTo(1000, 10);
    expect(b.x - (a.x + a.width)).toBeCloseTo(16, 10);
    expect(c.x - (b.x + b.width)).toBeCloseTo(16, 10);
  });

  it("maps x to the right panel and recognises gutters", () => {
    const total = 1000;
    const gutter = 16;
    const [a, b, c] = panelLayout(total, gutter);
    expect(panelAtX(a.x + a.width / 2, total, gutter)).toMatchObject({ panel: 0, inGutter: false });
    expect(panelAtX(b.x + b.width / 2, total, gutter)).toMatchObject({ panel: 1, inGutter: false });
    expect(panelAtX(c.x + c.width / 2, total, gutter)).toMatchObject({ panel: 2, inGutter: false });
    expect(panelAtX(a.width + gutter / 2, total, gutter).inGutter).toBe(true);
    expect(panelAtX(b.x + b.width + gutter / 2, total, gutter).inGutter).toBe(true);
  });

  it("never returns a panel outside 0..2", () => {
    expect(panelAtX(-50, 900, 12).panel).toBe(0);
    expect(panelAtX(5000, 900, 12).panel).toBe(2);
  });
});

describe("colour helpers", () => {
  it("converts hex to 0..1 floats", () => {
    expect(hexToRgb01("#ffffff")).toEqual([1, 1, 1]);
    expect(hexToRgb01("#000000")).toEqual([0, 0, 0]);
    const [r, g, b] = hexToRgb01("#1f5bff");
    expect(r).toBeCloseTo(31 / 255, 10);
    expect(g).toBeCloseTo(91 / 255, 10);
    expect(b).toBe(1);
  });

  it("rejects malformed colours", () => {
    expect(() => hexToRgb01("#fff")).toThrow();
    expect(() => hexToRgb01("blue")).toThrow();
  });

  it("every field colour is a valid hex", () => {
    for (const tone of Object.values(FIELD_COLORS)) {
      for (const colour of Object.values(tone)) expect(() => hexToRgb01(colour)).not.toThrow();
    }
  });
});
