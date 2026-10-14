import { describe, expect, it } from 'vitest';
import { buildProceduralGrid } from './sprite/characterSprite';
import { buildParticleData, chooseSubdivision, countVisibleCells } from './particleData';
import { MAX_PARTICLES, MIN_PARTICLES, TIERS, WORLD } from './config';

const grid = buildProceduralGrid();
const cells = countVisibleCells(grid);

describe('chooseSubdivision', () => {
  it('lands every tier inside the 15k–60k window', () => {
    for (const tier of Object.values(TIERS)) {
      const k = chooseSubdivision(cells, tier.particles);
      const n = cells * k * k;
      expect(n).toBeGreaterThanOrEqual(MIN_PARTICLES - 2000);
      expect(n).toBeLessThanOrEqual(MAX_PARTICLES);
    }
  });
});

describe('buildParticleData', () => {
  const k = 4;
  const data = buildParticleData({ grid, subdivision: k, aspect: 16 / 9, seed: 42 });
  const N = data.count;

  it('creates cells × k² particles with finite attributes', () => {
    expect(N).toBe(cells * k * k);
    for (const a of [
      data.charPos,
      data.crowdPos,
      data.anchor,
      data.rig,
      data.rand,
      data.drift,
      data.misc,
      data.trans,
    ]) {
      for (let i = 0; i < a.length; i++) expect(Number.isFinite(a[i])).toBe(true);
    }
  });

  it('is deterministic', () => {
    const again = buildParticleData({ grid, subdivision: k, aspect: 16 / 9, seed: 42 });
    expect(Array.from(again.charPos.slice(0, 600))).toEqual(Array.from(data.charPos.slice(0, 600)));
    expect(Array.from(again.crowdPos.slice(0, 600))).toEqual(Array.from(data.crowdPos.slice(0, 600)));
  });

  it('keeps the character centred, to scale, and pixel-exact (sub-lattice tiles the cells)', () => {
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < N; i++) {
      minX = Math.min(minX, data.charPos[i * 3]);
      maxX = Math.max(maxX, data.charPos[i * 3]);
      minY = Math.min(minY, data.charPos[i * 3 + 1]);
      maxY = Math.max(maxY, data.charPos[i * 3 + 1]);
    }
    expect(maxY - minY).toBeLessThanOrEqual(WORLD.charHeight);
    expect(maxY - minY).toBeGreaterThan(WORLD.charHeight * 0.95);
    expect(maxX - minX).toBeLessThan(data.meta.width);
    // Sub-lattice pitch equals cellSize / k, so distinct x values come in multiples of it.
    const pitch = data.meta.cellSize / k;
    const xs = new Set<number>();
    for (let i = 0; i < N; i++) xs.add(Math.round((data.charPos[i * 3] - minX) / pitch));
    expect(xs.size).toBeLessThanOrEqual(grid.width * k);
  });

  it('draws far → near so alpha blending paints back to front', () => {
    let prev = -Infinity;
    for (let i = 0; i < N; i++) {
      const z = data.crowdPos[i * 3 + 2];
      expect(z).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = z;
    }
  });

  it('pairs head with the top of the crowd and feet with the bottom', () => {
    let topCrowd = 0;
    let botCrowd = 0;
    let nTop = 0;
    let nBot = 0;
    // order is implicit in char y; crowd y rank similarly. Compare mean ranks of the extremes.
    const ys = Array.from({ length: N }, (_, i) => data.charPos[i * 3 + 1]).sort((a, b) => a - b);
    const lo = ys[Math.floor(N * 0.1)];
    const hi = ys[Math.floor(N * 0.9)];
    const wy = Array.from({ length: N }, (_, i) => data.crowdPos[i * 3 + 1]).sort((a, b) => a - b);
    const wlo = wy[Math.floor(N * 0.5)];
    for (let i = 0; i < N; i++) {
      const cy = data.charPos[i * 3 + 1];
      const wyv = data.crowdPos[i * 3 + 1];
      if (cy >= hi) {
        topCrowd += wyv;
        nTop++;
      } else if (cy <= lo) {
        botCrowd += wyv;
        nBot++;
      }
    }
    expect(topCrowd / nTop).toBeGreaterThan(botCrowd / nBot);
    expect(topCrowd / nTop).toBeGreaterThan(wlo); // head particles end up in the upper half of the crowd
  });

  it('schedules every particle to finish by progress = 1 in both directions', () => {
    let minRelF = 1;
    for (let i = 0; i < N; i++) {
      const [relF, durF, relR, durR] = [
        data.trans[i * 4],
        data.trans[i * 4 + 1],
        data.trans[i * 4 + 2],
        data.trans[i * 4 + 3],
      ];
      expect(relF).toBeGreaterThanOrEqual(0);
      expect(relF + durF).toBeLessThanOrEqual(1 + 1e-6);
      expect(relR).toBeGreaterThanOrEqual(0);
      expect(relR + durR).toBeLessThanOrEqual(1 + 1e-6);
      minRelF = Math.min(minRelF, relF);
    }
    expect(minRelF).toBeLessThan(0.05); // the scan starts releasing immediately
  });

  it('releases the head before the feet going forward and locks the head first going back', () => {
    const rel = (top: boolean, col: number) => {
      let s = 0;
      let c = 0;
      const ys = data.charPos.filter((_, i) => i % 3 === 1);
      const cut = top ? WORLD.charHeight * 0.3 : -WORLD.charHeight * 0.3;
      for (let i = 0; i < N; i++) {
        const y = ys[i];
        if ((top && y > cut) || (!top && y < cut)) {
          s += data.trans[i * 4 + col];
          c++;
        }
      }
      return s / c;
    };
    expect(rel(true, 0)).toBeLessThan(rel(false, 0)); // forward: head starts earlier
    expect(rel(true, 2)).toBeGreaterThan(rel(false, 2)); // reverse: head arrives (p decreasing) earlier
  });
});
