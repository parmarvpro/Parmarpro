import { SCAN, WORLD } from './config';
import { lerp, smoothstep } from './rng';

/**
 * Camera as a pure function of `progress`, so the path is deterministic, reversible and shares its
 * start and end pose with the loop:
 *   - 0 → ~0.1   almost static on the character
 *   - ~0.02–0.22 very slight push-in while it dissolves
 *   - ~0.12–0.72 small lateral move that follows the flow, easing back to centre
 *   - ~0.3–0.98  gradual widening that reveals the whole crowd
 *   - at rest in the crowd: a stable composition
 */

const TAN_HALF_FOV = Math.tan((WORLD.fov * Math.PI) / 360);

/** Distance at which the character fills `charScreenFill` of the viewport height (and fits the width). */
export function characterCameraDistance(aspect: number, charWidth: number): number {
  const byHeight = WORLD.charHeight / WORLD.charScreenFill / (2 * TAN_HALF_FOV);
  // Leave room either side for the stream: the sprite may use at most ~half the viewport width.
  const byWidth = charWidth / 0.5 / (2 * TAN_HALF_FOV * Math.max(aspect, 0.2));
  return Math.max(byHeight, byWidth);
}

export interface CameraPose {
  x: number;
  y: number;
  z: number;
  lookX: number;
  lookY: number;
  /** View-space distance of the plane that is in focus. */
  focus: number;
}

/** Distance of the crowd row that sits in focus: the near rows, so the background falls progressively soft. */
export const CROWD_FOCUS = 24;

export function cameraPose(progress: number, charDist: number): CameraPose {
  const p = progress;
  const push = smoothstep(0.02, 0.22, p);
  const widen = smoothstep(0.3, 0.98, p);
  const z = lerp(lerp(charDist, charDist * 0.94, push), WORLD.crowdCamDist, widen);
  const x = 1.4 * Math.sin(Math.PI * smoothstep(0.12, 0.72, p));
  const y = lerp(0, WORLD.crowdCamY, smoothstep(0.4, 1, p));
  const focus = lerp(z, CROWD_FOCUS, smoothstep(0.55, 1, p));
  return { x, y, z, lookX: x * 0.35, lookY: y, focus };
}

/** World y of the scan band for a given progress (head → feet over Stage B), clear of the sprite. */
export function scanY(progress: number, top: number, bottom: number): number {
  const k = Math.min(1, Math.max(0, progress / SCAN.end));
  return top + SCAN.margin - (top - bottom + 2 * SCAN.margin) * k;
}

/** 0 → 1 → 0 gate for the visible scan band; only the outbound direction scans. */
export function scanGate(progress: number, dir: number): number {
  const fadeIn = smoothstep(0.0, 0.012, progress);
  const fadeOut = 1 - smoothstep(SCAN.end * 0.96, SCAN.end * 1.12, progress);
  return fadeIn * fadeOut * (1 - dir);
}

/** How strongly pointer parallax is allowed to move the camera (almost none on the character). */
export function parallaxAmount(progress: number): number {
  return lerp(0.1, 1, smoothstep(0.55, 1, progress));
}

/** 0 (charcoal character stage) → 1 (luminous crowd stage): shared by backdrop, grade and HUD-free look. */
export function crowdMix(progress: number): number {
  return smoothstep(0.4, 0.9, progress);
}
