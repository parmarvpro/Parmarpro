import { describe, expect, it } from 'vitest';
import { TIMELINE } from './config';
import { cinematicProgress, TransitionController } from './controller';

const step = (c: TransitionController, seconds: number, fps = 60) => {
  const trace: number[] = [];
  for (let i = 0; i < seconds * fps; i++) {
    c.update(1 / fps);
    trace.push(c.progress);
  }
  return trace;
};

describe('cinematic timeline (brief: 0–19 s)', () => {
  it('holds the character for 2 s, then rises linearly to the crowd at 11 s', () => {
    expect(cinematicProgress(0).progress).toBe(0);
    expect(cinematicProgress(1.99).progress).toBe(0);
    expect(cinematicProgress(2).progress).toBe(0);
    expect(cinematicProgress(6.5).progress).toBeCloseTo(0.5, 6); // "progress = 0.5: transitional stream"
    expect(cinematicProgress(11).progress).toBe(1);
  });

  it('holds the crowd 11–14 s, then reverses to the character by 19 s', () => {
    expect(cinematicProgress(12.5).progress).toBe(1);
    expect(cinematicProgress(14).progress).toBe(1);
    expect(cinematicProgress(16.5).progress).toBeCloseTo(0.5, 6);
    expect(cinematicProgress(19 - 1e-6).progress).toBeCloseTo(0, 4);
  });

  it('loops cleanly: the end state equals the start state', () => {
    expect(cinematicProgress(TIMELINE.loop).progress).toBe(cinematicProgress(0).progress);
  });

  it('maps stage boundaries onto progress (B 2–3 s, C 3–4 s, D 4–6 s, E 6–8 s)', () => {
    expect(cinematicProgress(3).progress).toBeCloseTo(1 / 9, 6);
    expect(cinematicProgress(4).progress).toBeCloseTo(2 / 9, 6);
    expect(cinematicProgress(6).progress).toBeCloseTo(4 / 9, 6);
    expect(cinematicProgress(8).progress).toBeCloseTo(6 / 9, 6);
  });
});

describe('TransitionController', () => {
  it('starts in the auto loop and follows the cinematic', () => {
    const c = new TransitionController();
    step(c, 4.5);
    expect(c.progress).toBeCloseTo(cinematicProgress(4.5).progress, 2);
    expect(c.mode).toBe('auto');
  });

  it('click at rest goes to the other state and completes', () => {
    const c = new TransitionController({ auto: false });
    c.toggle();
    expect(c.target).toBe(1);
    step(c, 11);
    expect(c.progress).toBe(1);
    c.toggle();
    expect(c.target).toBe(0);
    step(c, 7);
    expect(c.progress).toBe(0);
  });

  it('is interruptible: a click mid-flight reverses from the current progress, never restarting', () => {
    const c = new TransitionController({ auto: false });
    c.toggle();
    step(c, 4);
    const mid = c.progress;
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
    c.toggle();
    const trace = step(c, 2);
    // no jump: the first frame after the click is within a tiny step of where it was
    expect(Math.abs(trace[0] - mid)).toBeLessThan(0.01);
    // the heading turned around smoothly: progress eventually decreases...
    expect(trace[trace.length - 1]).toBeLessThan(mid);
    // ...and never makes a discontinuous leap anywhere along the way
    let prev = mid;
    for (const p of trace) {
      expect(Math.abs(p - prev)).toBeLessThan(0.01);
      prev = p;
    }
  });

  it('handing over from auto mid-forward reverses; during the crowd hold it goes back; at the start it goes forward', () => {
    const mid = new TransitionController();
    step(mid, 5);
    mid.toggle();
    expect(mid.mode).toBe('manual');
    expect(mid.target).toBe(0);

    const hold = new TransitionController();
    step(hold, 12.5);
    hold.toggle();
    expect(hold.target).toBe(0);

    const start = new TransitionController();
    step(start, 1);
    start.toggle();
    expect(start.target).toBe(1);

    const rev = new TransitionController();
    step(rev, 16);
    rev.toggle(); // reversing the reversal heads back to the crowd
    expect(rev.target).toBe(1);
  });

  it('smooths the heading so reversing mid-flight cannot pop', () => {
    const c = new TransitionController({ auto: false });
    c.toggle();
    step(c, 5);
    expect(c.dir).toBe(0);
    c.toggle();
    let prev = c.dir;
    for (let i = 0; i < 120; i++) {
      c.update(1 / 60);
      expect(Math.abs(c.dir - prev)).toBeLessThan(0.1);
      prev = c.dir;
    }
    expect(c.dir).toBe(1);
  });

  it('pre-flips the heading at rest so the next move starts with the right look', () => {
    const c = new TransitionController({ auto: false });
    c.toggle();
    step(c, 11);
    expect(c.progress).toBe(1);
    step(c, 1.5);
    expect(c.dir).toBe(1); // crowd at rest: the next move is the reverse
    c.toggle();
    step(c, 6);
    expect(c.progress).toBe(0);
    step(c, 1.5);
    expect(c.dir).toBe(0);
  });

  it('re-enters the loop without a jump when auto is switched back on', () => {
    const c = new TransitionController({ auto: false });
    c.toggle();
    step(c, 4);
    const p = c.progress;
    c.setMode('auto');
    step(c, 1 / 60);
    expect(Math.abs(c.progress - p)).toBeLessThan(0.02);
  });

  it('scrubbing pins progress; freezing pins direction exactly', () => {
    const c = new TransitionController();
    c.scrubTo(0.4);
    step(c, 1);
    expect(c.progress).toBeCloseTo(0.4, 6);
    c.freeze(0.7, 1);
    step(c, 1);
    expect(c.progress).toBeCloseTo(0.7, 6);
    expect(c.dir).toBe(1);
  });
});
