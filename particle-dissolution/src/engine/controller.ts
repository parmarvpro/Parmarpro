import { TIMELINE } from './config';
import { clamp } from './rng';

/**
 * Single source of truth for the transition.
 *
 * `progress` ∈ [0, 1] is the only animation parameter the renderer sees:
 *   0   fully reconstructed pixel character
 *   0.5 transitional particle stream
 *   1   fully reconstructed crowd
 *
 * Two ways to drive it, both interruptible and reversible without ever restarting:
 *   - auto:   a deterministic cinematic loop (hold → forward → hold → reverse), a pure function of time
 *   - manual: click / space / scroll set a target; progress eases toward it from wherever it is
 *
 * `dir` is the smoothed heading (0 → crowd, 1 → character). It selects direction-specific looks
 * (the scan on the way out, the funnel on the way back) and is eased so reversing mid-flight never
 * pops.
 */

export type Mode = 'auto' | 'manual';
export type Heading = 'toCrowd' | 'toCharacter';

export interface ControllerOptions {
  /** Seconds for a full forward / reverse traverse in manual mode. */
  forwardSeconds?: number;
  reverseSeconds?: number;
  /** Seconds the heading takes to cross-fade when it flips. */
  dirBlendSeconds?: number;
  /** Start in the cinematic loop? */
  auto?: boolean;
}

const REST = 0.0005;

/** Cinematic progress for a given loop time (seconds). Pure and deterministic. */
export function cinematicProgress(loopTime: number): { progress: number; heading: Heading; rising: boolean } {
  const T = TIMELINE;
  const t = ((loopTime % T.loop) + T.loop) % T.loop;
  if (t < T.forwardStart) return { progress: 0, heading: 'toCrowd', rising: false };
  if (t < T.forwardEnd)
    return { progress: (t - T.forwardStart) / T.forwardDuration, heading: 'toCrowd', rising: true };
  if (t < T.reverseStart) return { progress: 1, heading: 'toCharacter', rising: false }; // hold; the next move is the reverse
  return { progress: 1 - (t - T.reverseStart) / T.reverseDuration, heading: 'toCharacter', rising: false };
}

export class TransitionController {
  progress = 0;
  dir = 0;
  mode: Mode;
  heading: Heading = 'toCrowd';
  /** Where manual easing is heading: 0 character, 1 crowd. */
  target: 0 | 1 = 0;
  loopTime = 0;

  private velocity = 0;
  private fwd: number;
  private rev: number;
  private readonly blend: number;
  /** progress is pinned by a scrub / debug freeze rather than eased */
  private pinned = false;
  /** dir is pinned too (debug capture) */
  private dirPinned = false;

  constructor(opts: ControllerOptions = {}) {
    this.fwd = opts.forwardSeconds ?? TIMELINE.forwardDuration;
    this.rev = opts.reverseSeconds ?? TIMELINE.reverseDuration;
    this.blend = opts.dirBlendSeconds ?? 0.7;
    this.mode = opts.auto === false ? 'manual' : 'auto';
  }

  /** Manual-mode traverse times (seconds); the calm / reduced-motion setting shortens them. */
  setDurations(forwardSeconds: number, reverseSeconds: number): void {
    this.fwd = forwardSeconds;
    this.rev = reverseSeconds;
  }

  /** True while particles are actually between the two states. */
  get inTransit(): boolean {
    return this.progress > REST && this.progress < 1 - REST;
  }

  /**
   * Click / tap / space.
   *   at rest      → go to the other state
   *   in transit   → turn around (continue from the current progress, never restart)
   * In the cinematic loop this also hands control to the user (manual mode).
   */
  toggle(): void {
    const wasRising = this.mode === 'auto' ? cinematicProgress(this.loopTime).rising : this.target === 1;
    this.mode = 'manual';
    this.pinned = false;
    this.dirPinned = false;
    this.velocity = 0;
    if (this.progress <= REST) this.target = 1;
    else if (this.progress >= 1 - REST) this.target = 0;
    else this.target = wasRising ? 0 : 1;
    this.heading = this.target === 1 ? 'toCrowd' : 'toCharacter';
  }

  setMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.pinned = false;
    this.dirPinned = false;
    if (mode === 'auto') {
      // Re-enter the loop at the point that matches where we are, so there is no jump.
      const T = TIMELINE;
      if (this.progress <= REST) this.loopTime = 0;
      else if (this.progress >= 1 - REST) this.loopTime = T.forwardEnd;
      else if (this.heading === 'toCharacter')
        this.loopTime = T.reverseStart + (1 - this.progress) * T.reverseDuration;
      else this.loopTime = T.forwardStart + this.progress * T.forwardDuration;
    }
  }

  setTarget(target: 0 | 1): void {
    this.mode = 'manual';
    this.pinned = false;
    this.dirPinned = false;
    this.target = target;
    this.heading = target === 1 ? 'toCrowd' : 'toCharacter';
  }

  /** Scroll / scrub: set progress directly. Heading follows the direction of the scrub. */
  scrubTo(p: number): void {
    this.mode = 'manual';
    this.dirPinned = false;
    const next = clamp(p, 0, 1);
    if (next > this.progress) this.heading = 'toCrowd';
    else if (next < this.progress) this.heading = 'toCharacter';
    this.progress = next;
    this.target = this.heading === 'toCrowd' ? 1 : 0;
    this.velocity = 0;
    this.pinned = true;
  }

  /** Debug / deterministic capture: pin progress and direction exactly, no smoothing. */
  freeze(progress: number, dir: number): void {
    this.mode = 'manual';
    this.progress = clamp(progress, 0, 1);
    this.dir = clamp(dir, 0, 1);
    this.heading = this.dir > 0.5 ? 'toCharacter' : 'toCrowd';
    this.target = this.heading === 'toCrowd' ? 1 : 0;
    this.velocity = 0;
    this.pinned = true;
    this.dirPinned = true;
  }

  update(dt: number): void {
    dt = clamp(dt, 0, 0.1);

    if (this.mode === 'auto') {
      this.loopTime += dt;
      const c = cinematicProgress(this.loopTime);
      this.progress = c.progress;
      this.heading = c.heading;
      this.target = c.heading === 'toCrowd' ? 1 : 0;
    } else if (!this.pinned) {
      // Ease toward the target with a speed that ramps up and down, so turning around is smooth.
      const goal = this.target;
      const reached = goal === 1 ? this.progress >= 1 : this.progress <= 0;
      const wanted = reached ? 0 : goal === 1 ? 1 / this.fwd : -1 / this.rev;
      this.velocity += (wanted - this.velocity) * (1 - Math.exp(-dt / 0.35));
      this.progress = clamp(this.progress + this.velocity * dt, 0, 1);
      if (goal === 1 ? this.progress > 1 - 1e-4 : this.progress < 1e-4) {
        this.progress = goal;
        this.velocity = 0;
      }
    }

    if (this.dirPinned) return;
    // Heading → smoothed direction. At rest the *next* move is the opposite one, so pre-flip.
    let dirTarget = this.heading === 'toCharacter' ? 1 : 0;
    if (this.progress >= 1 - REST) dirTarget = 1;
    else if (this.progress <= REST) dirTarget = 0;
    this.dir += (dirTarget - this.dir) * (1 - Math.exp(-dt / (this.blend / 3)));
    if (Math.abs(dirTarget - this.dir) < 0.002) this.dir = dirTarget;
  }
}
