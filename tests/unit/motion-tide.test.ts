import { describe, expect, it } from "vitest";

import { TIDE_PERIOD_PX, TIDE_PITCH_PX, TIDE_RADIUS_MAX, TIDE_RADIUS_MIN, TIDE_ROWS, tideRadius } from "@/lib/motion/tide";

describe("halftone tide", () => {
  it("fits a whole number of dot rows in one period", () => {
    expect(Number.isInteger(TIDE_ROWS)).toBe(true);
    expect(TIDE_ROWS * TIDE_PITCH_PX).toBe(TIDE_PERIOD_PX);
  });

  it("keeps every dot inside its cell", () => {
    for (let row = 0; row < TIDE_ROWS; row += 1) {
      const radius = tideRadius(row);
      expect(radius).toBeGreaterThanOrEqual(TIDE_RADIUS_MIN);
      expect(radius).toBeLessThanOrEqual(TIDE_RADIUS_MAX);
    }
    expect(TIDE_RADIUS_MAX * 2).toBeLessThan(TIDE_PITCH_PX);
  });

  it("repeats exactly after one period, so the loop has no jump", () => {
    for (let row = 0; row < TIDE_ROWS; row += 1) {
      expect(tideRadius(row + TIDE_ROWS)).toBeCloseTo(tideRadius(row), 9);
    }
  });

  it("actually varies, so the dots visibly swell and shrink", () => {
    const radii = Array.from({ length: TIDE_ROWS }, (_, row) => tideRadius(row));
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(2.5);
  });
});
