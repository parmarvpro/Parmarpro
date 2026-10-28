/**
 * Geometry of the "tide": a halftone whose dot size swells and shrinks along
 * one smooth wave per period. The layer travels exactly one period per loop,
 * so the animation restarts without a visible jump.
 */

/** Height in px of one full cycle. The CSS keyframes travel exactly this far. */
export const TIDE_PERIOD_PX = 400;
/** Dot pitch in px. The period holds a whole number of rows. */
export const TIDE_PITCH_PX = 12.5;
export const TIDE_ROWS = TIDE_PERIOD_PX / TIDE_PITCH_PX;
export const TIDE_RADIUS_MIN = 0.5;
export const TIDE_RADIUS_MAX = 4.7;

/** Dot radius for a row. Periodic: tideRadius(row + TIDE_ROWS) === tideRadius(row). */
export function tideRadius(row: number): number {
  const phase = (row / TIDE_ROWS) * 2 * Math.PI;
  // A slow swell plus a smaller second harmonic, so the bands are not a plain sine.
  const wave = 0.5 + 0.38 * Math.sin(phase) + 0.12 * Math.sin(2 * phase + 0.9);
  const clamped = Math.min(1, Math.max(0, wave));
  return TIDE_RADIUS_MIN + (TIDE_RADIUS_MAX - TIDE_RADIUS_MIN) * clamped;
}
