import { MAX_PARTICLES, SCAN, WORLD } from './config';
import { generateCrowd, type CrowdSlots } from './crowd';
import { clamp, gaussian, hash01, mulberry32 } from './rng';
import type { PixelGrid } from './sprite/pixelGrid';

/**
 * Builds every GPU-bound particle attribute as flat typed arrays.
 *
 * One particle = one slot on the character *and* one slot in the crowd. The character side is a
 * k×k sub-lattice per visible sprite cell, so at rest the tiny squares tile into crisp pixels.
 * Slots are paired by vertical rank (head ↔ top of the crowd, feet ↔ bottom) with a left-to-right
 * sort inside each band, which keeps neighbouring particles together and avoids crossing streams.
 * The final order is far → near (by crowd depth) so alpha blending paints back-to-front.
 */

export interface ParticleData {
  count: number;
  /** Character-space rest position (xyz). Also the geometry's `position` attribute. */
  charPos: Float32Array;
  /** Crowd-space rest position (xyz). */
  crowdPos: Float32Array;
  /** Figure anchor: x, y(feet), z, height. */
  anchor: Float32Array;
  /** Figure seed, part id, pivot x, pivot y. */
  rig: Float32Array;
  /** Character colour rgb + opacity multiplier (bytes, normalised on upload). */
  colorChar: Uint8Array;
  /** Crowd colour rgb + opacity multiplier (bytes, normalised on upload). */
  colorCrowd: Uint8Array;
  /** phase, cluster hash, random a, random b. */
  rand: Float32Array;
  /** Drift direction (xyz), roughly unit length. */
  drift: Float32Array;
  /** id, depth(0 near…1 far), crowd particle size (world), edge(0 centre…1 silhouette). */
  misc: Float32Array;
  /** Per-particle transition schedule: relFwd, durFwd, relRev, durRev (in progress units). */
  trans: Float32Array;
  meta: CharacterMeta & { figures: number; subdivision: number };
}

export interface CharacterMeta {
  cells: number;
  cellSize: number;
  /** Character extent in world units. */
  width: number;
  height: number;
  top: number;
  bottom: number;
  /** World pitch of the sub-lattice (cell size / k). */
  subSize: number;
}

export interface BuildOptions {
  grid: PixelGrid;
  /** Sub-lattice factor k. N = visibleCells × k². */
  subdivision: number;
  aspect: number;
  seed: number;
}

/** Picks k so that cells × k² lands close to the particle budget (never above the hard cap). */
export function chooseSubdivision(cells: number, targetParticles: number): number {
  const k = Math.round(Math.sqrt(targetParticles / Math.max(1, cells)));
  const maxK = Math.floor(Math.sqrt(MAX_PARTICLES / Math.max(1, cells)));
  return clamp(k, 1, Math.max(1, maxK));
}

export function countVisibleCells(grid: PixelGrid): number {
  let n = 0;
  for (let i = 3; i < grid.rgba.length; i += 4) if (grid.rgba[i] > 0) n++;
  return n;
}

/** Index permutation that sorts `keys` ascending. */
function argsort(keys: Float32Array): Uint32Array {
  const idx = new Uint32Array(keys.length);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  idx.sort((a, b) => keys[a] - keys[b]);
  return idx;
}

/**
 * Split an already-sorted index list into `bands` equal rank bands, then re-sort each band by x.
 * Pairing the i-th element of two such lists gives a smooth, non-crossing transport map.
 */
function bandSortByX(order: Uint32Array, xs: Float32Array, bands: number): void {
  const n = order.length;
  for (let b = 0; b < bands; b++) {
    const lo = Math.floor((b * n) / bands);
    const hi = Math.floor(((b + 1) * n) / bands);
    const seg = order.subarray(lo, hi);
    seg.sort((a, c) => xs[a] - xs[c]);
  }
}

export function buildParticleData({ grid, subdivision: k, aspect, seed }: BuildOptions): ParticleData {
  const rand = mulberry32(seed);
  const cells = countVisibleCells(grid);
  const N = cells * k * k;
  if (N <= 0) throw new Error('particleData: empty character');
  if (N > MAX_PARTICLES + 2000) throw new Error(`particleData: ${N} particles exceeds the cap`);

  // ---------------------------------------------------------------- character side (canonical order)
  const cellSize = WORLD.charHeight / grid.height;
  const width = grid.width * cellSize;
  const height = grid.height * cellSize;
  const top = height / 2;
  const bottom = -height / 2;
  const sub = cellSize / k;

  const cPos = new Float32Array(N * 3);
  const cCol = new Uint8Array(N * 4);
  const cOrder = new Float32Array(N); // 0 at the top of the character … 1 at the feet
  const cGroup = new Float32Array(N); // cluster hash
  const cGroup2 = new Float32Array(N);
  const cKey = new Float32Array(N);
  let n = 0;
  for (let cy = 0; cy < grid.height; cy++) {
    for (let cx = 0; cx < grid.width; cx++) {
      const o = (cy * grid.width + cx) * 4;
      if (grid.rgba[o + 3] === 0) continue;
      const r = grid.rgba[o];
      const g = grid.rgba[o + 1];
      const b = grid.rgba[o + 2];
      const x0 = (cx - grid.width / 2) * cellSize;
      const y0 = (grid.height / 2 - cy) * cellSize;
      // "Small groups": 3×3-cell blocks share most of their hash, individual cells a bit of their own.
      const block = hash01(Math.floor(cx / 3), Math.floor(cy / 3), 11);
      const own = hash01(cx, cy, 23);
      const gr = block * 0.7 + own * 0.3;
      const gr2 = hash01(Math.floor(cx / 2), Math.floor(cy / 2), 37) * 0.7 + hash01(cx, cy, 41) * 0.3;
      const zCell = (own - 0.5) * 0.03;
      for (let j = 0; j < k; j++) {
        for (let i = 0; i < k; i++) {
          const px = x0 + ((i + 0.5) / k) * cellSize;
          const py = y0 - ((j + 0.5) / k) * cellSize;
          cPos[n * 3] = px;
          cPos[n * 3 + 1] = py;
          cPos[n * 3 + 2] = zCell;
          // Faint luminance texture inside each pixel: reads as the "ambient shimmer" at rest.
          const lum = 1 + (rand() - 0.5) * 0.07;
          cCol[n * 4] = clamp(r * lum, 0, 255);
          cCol[n * 4 + 1] = clamp(g * lum, 0, 255);
          cCol[n * 4 + 2] = clamp(b * lum, 0, 255);
          cCol[n * 4 + 3] = 255;
          const ord = clamp((top - py) / height, 0, 1);
          cOrder[n] = ord;
          cGroup[n] = clamp(gr + (rand() - 0.5) * 0.05, 0, 1);
          cGroup2[n] = clamp(gr2 + (rand() - 0.5) * 0.05, 0, 1);
          cKey[n] = ord + (rand() - 0.5) * 0.05;
          n++;
        }
      }
    }
  }

  // --------------------------------------------------------------------------------- crowd side
  const crowd: CrowdSlots = generateCrowd({ count: N, aspect, seed });
  const wKey = new Float32Array(N);
  const wX = new Float32Array(N);
  let yMin = Infinity;
  let yMax = -Infinity;
  for (let i = 0; i < N; i++) {
    const y = crowd.pos[i * 3 + 1];
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
    wX[i] = crowd.pos[i * 3];
  }
  const yRange = Math.max(1e-3, yMax - yMin);
  for (let i = 0; i < N; i++) wKey[i] = (yMax - crowd.pos[i * 3 + 1]) / yRange + (rand() - 0.5) * 0.05;

  // ------------------------------------------------------------------------------------ pairing
  const cOrderIdx = argsort(cKey);
  const wOrderIdx = argsort(wKey);
  const BANDS = 56;
  const cX = new Float32Array(N);
  for (let i = 0; i < N; i++) cX[i] = cPos[i * 3];
  bandSortByX(cOrderIdx, cX, BANDS);
  bandSortByX(wOrderIdx, wX, BANDS);

  // Final draw order: far → near by crowd depth (painter's algorithm), stable on ties.
  const pairs = new Uint32Array(N);
  for (let i = 0; i < N; i++) pairs[i] = i;
  const zOf = (pairIdx: number) => crowd.pos[wOrderIdx[pairIdx] * 3 + 2];
  pairs.sort((a, b) => zOf(a) - zOf(b) || a - b);

  // ---------------------------------------------------------------------------- assemble outputs
  const out: ParticleData = {
    count: N,
    charPos: new Float32Array(N * 3),
    crowdPos: new Float32Array(N * 3),
    anchor: new Float32Array(N * 4),
    rig: new Float32Array(N * 4),
    colorChar: new Uint8Array(N * 4),
    colorCrowd: new Uint8Array(N * 4),
    rand: new Float32Array(N * 4),
    drift: new Float32Array(N * 3),
    misc: new Float32Array(N * 4),
    trans: new Float32Array(N * 4),
    meta: {
      cells,
      cellSize,
      width,
      height,
      top,
      bottom,
      subSize: sub,
      figures: crowd.figures.length,
      subdivision: k,
    },
  };

  for (let j = 0; j < N; j++) {
    const pair = pairs[j];
    const c = cOrderIdx[pair];
    const w = wOrderIdx[pair];

    out.charPos.set(cPos.subarray(c * 3, c * 3 + 3), j * 3);
    out.crowdPos.set(crowd.pos.subarray(w * 3, w * 3 + 3), j * 3);
    out.anchor.set(crowd.anchor.subarray(w * 4, w * 4 + 4), j * 4);
    out.rig.set(crowd.rig.subarray(w * 4, w * 4 + 4), j * 4);
    out.colorChar.set(cCol.subarray(c * 4, c * 4 + 4), j * 4);
    out.colorCrowd.set(crowd.color.subarray(w * 4, w * 4 + 4), j * 4);

    const ra = rand();
    const rb = rand();
    out.rand[j * 4] = rand() * Math.PI * 2; // phase
    out.rand[j * 4 + 1] = cGroup[c];
    out.rand[j * 4 + 2] = ra;
    out.rand[j * 4 + 3] = rb;

    // Drift: biased sideways/up so the flow field starts from a coherent direction.
    const dx = gaussian(rand) * 0.6 + 0.45;
    const dy = gaussian(rand) * 0.5 + 0.15;
    const dz = gaussian(rand) * 0.4;
    const len = Math.hypot(dx, dy, dz) || 1;
    out.drift[j * 3] = dx / len;
    out.drift[j * 3 + 1] = dy / len;
    out.drift[j * 3 + 2] = dz / len;

    const edge = crowd.edge[w];
    out.misc[j * 4] = j; // stable particle id (post-sort, so it matches the buffer index)
    out.misc[j * 4 + 1] = crowd.depth[w];
    out.misc[j * 4 + 2] = crowd.size[w];
    out.misc[j * 4 + 3] = edge;

    // Forward (character → crowd): the scan sweeps head → feet over the first `SCAN.end` of progress,
    // then each 3×3-cell cluster leaves after its own delay. All particles land by progress = 1.
    const order = cOrder[c];
    const scanned = clamp((top + SCAN.margin - cPos[c * 3 + 1]) / (height + 2 * SCAN.margin), 0, 1);
    const relF = clamp(SCAN.end * scanned + 0.23 * cGroup[c] + (rb - 0.5) * 0.014, 0, 0.34);
    const durF = Math.min(0.62 + 0.04 * ra, 1 - relF);
    // Reverse (crowd → character): the head locks in first and the shoes last; silhouette edges peel
    // away from the crowd first (longer flight). All particles leave no earlier than progress = 1.
    const relR = clamp(0.42 * (0.72 * (1 - order) + 0.28 * cGroup2[c]), 0, 0.42);
    const durR = Math.min(0.5 + 0.08 * edge, 1 - relR);
    out.trans[j * 4] = relF;
    out.trans[j * 4 + 1] = durF;
    out.trans[j * 4 + 2] = relR;
    out.trans[j * 4 + 3] = durR;
  }

  return out;
}
