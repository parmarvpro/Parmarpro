import { describe, expect, it } from 'vitest';
import { cameraPose, characterCameraDistance, scanGate, scanY } from './camera';
import { SCAN, WORLD } from './config';

describe('camera path', () => {
  const D0 = characterCameraDistance(16 / 9, 1.8);

  it('frames the character to ~60% of the viewport height', () => {
    const visibleH = 2 * D0 * Math.tan((WORLD.fov * Math.PI) / 360);
    expect(WORLD.charHeight / visibleH).toBeCloseTo(WORLD.charScreenFill, 1);
  });

  it('starts at the character framing and ends on the crowd framing (clean loop)', () => {
    const a = cameraPose(0, D0);
    const b = cameraPose(1, D0);
    expect(a.z).toBeCloseTo(D0, 6);
    expect(a.x).toBeCloseTo(0, 6);
    expect(b.z).toBeCloseTo(WORLD.crowdCamDist, 6);
    expect(b.x).toBeCloseTo(0, 6);
    expect(b.y).toBeCloseTo(WORLD.crowdCamY, 6);
  });

  it('is nearly static while the character is stable', () => {
    const a = cameraPose(0, D0);
    const b = cameraPose(0.02, D0);
    expect(Math.abs(a.z - b.z)).toBeLessThan(0.05);
  });

  it('pushes in slightly during dissolution, then widens', () => {
    expect(cameraPose(0.22, D0).z).toBeLessThan(D0);
    expect(cameraPose(0.6, D0).z).toBeGreaterThan(cameraPose(0.3, D0).z);
  });

  it('moves smoothly: no jump between adjacent progress samples', () => {
    let prev = cameraPose(0, D0);
    for (let i = 1; i <= 1000; i++) {
      const c = cameraPose(i / 1000, D0);
      expect(Math.abs(c.z - prev.z)).toBeLessThan(0.15);
      expect(Math.abs(c.x - prev.x)).toBeLessThan(0.05);
      prev = c;
    }
  });

  it('is height-limited for a narrow profile sprite, even on a portrait phone', () => {
    expect(characterCameraDistance(0.46, 1.8)).toBeCloseTo(D0, 6);
  });

  it('backs off when the sprite would exceed half the viewport width (wide art / very tall screen)', () => {
    const d = characterCameraDistance(0.3, 1.8);
    expect(d).toBeGreaterThan(D0);
    const visibleW = 2 * d * Math.tan((WORLD.fov * Math.PI) / 360) * 0.3;
    expect(1.8 / visibleW).toBeLessThanOrEqual(0.5 + 1e-6);
  });
});

describe('scan band', () => {
  it('sweeps from above the head to below the feet across Stage B', () => {
    const top = 3;
    const bottom = -3;
    expect(scanY(0, top, bottom)).toBeCloseTo(top + SCAN.margin, 6);
    expect(scanY(SCAN.end, top, bottom)).toBeCloseTo(bottom - SCAN.margin, 6);
    expect(scanY(0.5, top, bottom)).toBeCloseTo(bottom - SCAN.margin, 6);
    expect(scanY(SCAN.end / 2, top, bottom)).toBeCloseTo(0, 6);
  });

  it('is only visible on the way out and only during the scan', () => {
    expect(scanGate(0, 0)).toBe(0);
    expect(scanGate(SCAN.end * 0.5, 0)).toBeCloseTo(1, 1);
    expect(scanGate(0.3, 0)).toBe(0);
    expect(scanGate(SCAN.end * 0.5, 1)).toBe(0);
  });
});
