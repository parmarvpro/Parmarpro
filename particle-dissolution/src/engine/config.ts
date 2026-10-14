/**
 * Shared constants: palette, world scale, camera, timeline and quality tiers.
 * Everything that shapes the look or the pacing lives here so it can be tuned in one place.
 */

/** Crowd palette from the brief (sRGB hex). */
export const PALETTE = {
  yellow: '#F5C84B',
  coral: '#FF796D',
  pink: '#F28EAD',
  cyan: '#56C8DC',
  teal: '#20B8A4',
  blue: '#2767B8',
  orange: '#FF9B49',
  lavender: '#A79BEA',
} as const;

export const PALETTE_LIST: readonly string[] = Object.values(PALETTE);

/** Background light colours for the crowd state (diffused warm light). */
export const GLOW = {
  cream: '#FFF1D2',
  yellow: '#F7D36E',
  coral: '#FF9C8C',
  cyan: '#8FD9E6',
  haze: '#FFF0D8',
} as const;

export const WORLD = {
  /** Height of the pixel character in world units. */
  charHeight: 6.0,
  /** Vertical field of view (degrees). */
  fov: 32,
  /** Camera distance from the z=0 plane in the crowd state. */
  crowdCamDist: 30,
  /** Camera height in the crowd state. */
  crowdCamY: 0.4,
  /** Nominal world height of one crowd figure. */
  figureHeight: 5.6,
  /** Fraction of the viewport height the character fills at rest. */
  charScreenFill: 0.6,
} as const;

/**
 * Cinematic timeline in seconds (brief section 4–7). `progress` runs 0 → 1 across the forward
 * transition, which spans scan-start to crowd-lock; the reverse spans its own window.
 */
export const TIMELINE = {
  holdCharacter: 2, // Stage A
  forwardStart: 2, // Stage B begins
  forwardEnd: 11, // crowd reconstruction complete
  holdCrowd: 3, // 11–14 s crowd animation
  reverseStart: 14,
  reverseEnd: 19,
  get loop() {
    return this.reverseEnd;
  },
  get forwardDuration() {
    return this.forwardEnd - this.forwardStart;
  },
  get reverseDuration() {
    return this.reverseEnd - this.reverseStart;
  },
} as const;

/**
 * The scan band sweeps the character head → feet over the first `end` of progress (Stage B), starting
 * `margin` above the head and finishing `margin` below the feet so it fully clears the sprite.
 */
export const SCAN = {
  end: 1 / 9,
  margin: 0.4,
} as const;

/** Where the cinematic stages fall on the shared progress axis (for the HUD and docs). */
export const STAGES = [
  { id: 'A', label: 'Stable', from: 0, to: 0 },
  { id: 'B', label: 'Scan', from: 0, to: 1 / 9 },
  { id: 'C', label: 'Breakup', from: 1 / 9, to: 2 / 9 },
  { id: 'D', label: 'Disintegration', from: 2 / 9, to: 4 / 9 },
  { id: 'E', label: 'Particle field', from: 4 / 9, to: 6 / 9 },
  { id: 'F', label: 'Reconstruction', from: 6 / 9, to: 1 },
] as const;

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

export interface TierSettings {
  /** Approximate particle budget; the real count is cells × k². */
  particles: number;
  maxDpr: number;
  /** Run the HDR composer (grade + bloom). Off = render straight to the canvas. */
  post: boolean;
  bloom: boolean;
}

export const TIERS: Record<QualityTier, TierSettings> = {
  low: { particles: 16000, maxDpr: 1.5, post: false, bloom: false },
  medium: { particles: 30000, maxDpr: 2, post: true, bloom: false },
  high: { particles: 46000, maxDpr: 2, post: true, bloom: true },
  ultra: { particles: 58000, maxDpr: 2, post: true, bloom: true },
};

export const MAX_PARTICLES = 60000;
export const MIN_PARTICLES = 15000;
export const SEED = 0x5eed1e;
