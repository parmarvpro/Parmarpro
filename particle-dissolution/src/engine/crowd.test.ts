import { describe, expect, it } from 'vitest';
import { WORLD } from './config';
import { generateCrowd, PART } from './crowd';

describe('generateCrowd', () => {
  const opts = { count: 20000, aspect: 16 / 9, seed: 1234 };
  const crowd = generateCrowd(opts);

  it('writes exactly the requested number of slots with finite values', () => {
    expect(crowd.count).toBe(20000);
    for (const arr of [crowd.pos, crowd.anchor, crowd.rig, crowd.size, crowd.edge, crowd.depth]) {
      for (let i = 0; i < arr.length; i++) expect(Number.isFinite(arr[i])).toBe(true);
    }
  });

  it('is deterministic for a given seed and differs for another', () => {
    const again = generateCrowd(opts);
    expect(Array.from(again.pos.slice(0, 300))).toEqual(Array.from(crowd.pos.slice(0, 300)));
    const other = generateCrowd({ ...opts, seed: 99 });
    expect(Array.from(other.pos.slice(0, 30))).not.toEqual(Array.from(crowd.pos.slice(0, 30)));
  });

  it('produces dozens of figures spread over several depth layers', () => {
    expect(crowd.figures.length).toBeGreaterThanOrEqual(40);
    expect(new Set(crowd.figures.map((f) => f.row)).size).toBe(7);
    expect(crowd.figures.reduce((a, f) => a + f.count, 0)).toBe(20000);
    for (const f of crowd.figures) expect(f.count).toBeGreaterThanOrEqual(36);
  });

  it('gives near figures more particles and larger particles than far ones', () => {
    const near = crowd.figures.filter((f) => f.row === 6);
    const far = crowd.figures.filter((f) => f.row === 0);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(near.map((f) => f.count))).toBeGreaterThan(avg(far.map((f) => f.count)) * 3);
    // Compare projected (screen) size: world size divided by distance from the crowd camera.
    let nearSize = 0;
    let nearN = 0;
    let farSize = 0;
    let farN = 0;
    for (let i = 0; i < crowd.count; i++) {
      if (crowd.rig[i * 4 + 1] === PART.halo) continue;
      const projected = crowd.size[i] / (WORLD.crowdCamDist - crowd.anchor[i * 4 + 2]);
      if (crowd.depth[i] === 0) {
        nearSize += projected;
        nearN++;
      } else if (crowd.depth[i] === 1) {
        farSize += projected;
        farN++;
      }
    }
    expect(nearSize / nearN).toBeGreaterThan((farSize / farN) * 1.5);
  });

  it('uses every body-part id', () => {
    const seen = new Set<number>();
    for (let i = 0; i < crowd.count; i++) seen.add(crowd.rig[i * 4 + 1]);
    for (const id of Object.values(PART)) expect(seen.has(id)).toBe(true);
  });

  it('adapts the figure count to the viewport aspect (portrait → fewer figures)', () => {
    const portrait = generateCrowd({ ...opts, aspect: 0.46 });
    expect(portrait.figures.length).toBeLessThan(crowd.figures.length / 2);
    expect(portrait.figures.length).toBeGreaterThan(20);
  });
});
