/**
 * Turns an arbitrary image of a pixel-art character into a clean grid of cells.
 *
 * The brief supplies the character as an image with a muted grey background, usually up-scaled
 * with nearest-neighbour so each art pixel is a block of screen pixels. This module is pure (no
 * DOM) so it can be unit-tested:
 *
 *   1. Work out the foreground mask: real alpha when the PNG has transparency, otherwise a
 *      flood-fill from the border that removes the (possibly noisy / gradient) backdrop.
 *   2. Crop to the foreground bounding box.
 *   3. Detect the pixel-art block size from where colour edges fall, and sample one colour per block.
 *      Images that are not blocky are area-averaged down to a manageable number of rows instead.
 */

export interface RGBAImage {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

export interface PixelGrid {
  width: number;
  height: number;
  /** width*height*4, alpha is exactly 0 or 255. */
  rgba: Uint8ClampedArray;
}

export interface GridOptions {
  /** Max RGB distance (0..441) from the reference backdrop colour to count as background. */
  backgroundTolerance?: number;
  /** Max step between neighbouring backdrop pixels, lets the fill follow soft gradients / noise. */
  backgroundStep?: number;
  /** Non-blocky images are resampled to at most this many rows. */
  maxRows?: number;
  /** Largest pixel-art block size to look for. */
  maxBlock?: number;
}

const DEFAULTS: Required<GridOptions> = {
  backgroundTolerance: 60,
  backgroundStep: 14,
  maxRows: 72,
  maxBlock: 40,
};

const idx = (x: number, y: number, w: number) => (y * w + x) * 4;

function dist(a: ArrayLike<number>, ai: number, b: ArrayLike<number>, bi: number): number {
  const dr = a[ai] - b[bi];
  const dg = a[ai + 1] - b[bi + 1];
  const db = a[ai + 2] - b[bi + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** True when the image carries genuine transparency (not just an opaque backdrop). */
export function hasTransparency(img: RGBAImage): boolean {
  const { data, width, height } = img;
  let transparent = 0;
  for (let i = 3; i < width * height * 4; i += 4) if (data[i] < 250) transparent++;
  return transparent > Math.max(4, width * height * 0.002);
}

/** Most common (coarsely quantised) colour along the image border, returned as a pixel offset. */
function referenceBackground(img: RGBAImage): [number, number, number] {
  const { data, width, height } = img;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  const add = (x: number, y: number) => {
    const i = idx(x, y, width);
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += data[i];
    e.g += data[i + 1];
    e.b += data[i + 2];
    buckets.set(key, e);
  };
  for (let x = 0; x < width; x++) {
    add(x, 0);
    add(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    add(0, y);
    add(width - 1, y);
  }
  let best = { n: 0, r: 0, g: 0, b: 0 };
  for (const e of buckets.values()) if (e.n > best.n) best = e;
  return [best.r / best.n, best.g / best.n, best.b / best.n];
}

/** Foreground mask: 1 = character, 0 = backdrop / transparent. */
export function foregroundMask(img: RGBAImage, opts: Required<GridOptions>): Uint8Array {
  const { data, width, height } = img;
  const mask = new Uint8Array(width * height);

  if (hasTransparency(img)) {
    for (let i = 0; i < width * height; i++) mask[i] = data[i * 4 + 3] > 127 ? 1 : 0;
    return mask;
  }

  const ref = referenceBackground(img);
  const refBuf = new Uint8Array([ref[0], ref[1], ref[2]]);
  const isBg = new Uint8Array(width * height); // 1 once reached by the fill
  const stack: number[] = [];

  const consider = (x: number, y: number, fromI: number) => {
    const p = y * width + x;
    if (isBg[p]) return;
    const i = p * 4;
    const nearRef = dist(data, i, refBuf, 0) <= opts.backgroundTolerance;
    const nearNeighbour = fromI >= 0 && dist(data, i, data, fromI) <= opts.backgroundStep;
    if (nearRef && (fromI < 0 || nearNeighbour)) {
      isBg[p] = 1;
      stack.push(p);
    }
  };

  for (let x = 0; x < width; x++) {
    consider(x, 0, -1);
    consider(x, height - 1, -1);
  }
  for (let y = 0; y < height; y++) {
    consider(0, y, -1);
    consider(width - 1, y, -1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % width;
    const y = (p / width) | 0;
    const i = p * 4;
    if (x > 0) consider(x - 1, y, i);
    if (x < width - 1) consider(x + 1, y, i);
    if (y > 0) consider(x, y - 1, i);
    if (y < height - 1) consider(x, y + 1, i);
  }
  for (let p = 0; p < width * height; p++) mask[p] = isBg[p] ? 0 : 1;
  return mask;
}

interface Box {
  x0: number;
  y0: number;
  x1: number; // exclusive
  y1: number; // exclusive
}

export function maskBounds(mask: Uint8Array, width: number, height: number): Box | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/** Colour jumps below this are treated as noise (JPEG ringing, dithering), not art-pixel edges. */
const EDGE_NOISE_FLOOR = 24;

function edgeEnergy(maskChanged: boolean, colourJump: number): number {
  if (maskChanged) return 200;
  return colourJump >= EDGE_NOISE_FLOOR ? colourJump : 0;
}

/**
 * Pixel-art block size from edge positions. Colour changes between neighbouring columns (rows)
 * only occur on block boundaries, so for the true size `s` the edge energy piles up in a single
 * residue class modulo `s`. Returns 1 when no blocky structure is found.
 */
export function detectBlockSize(
  img: RGBAImage,
  box: Box,
  mask: Uint8Array,
  maxBlock: number,
): { size: number; ox: number; oy: number } {
  const { data, width } = img;
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  const ex = new Float64Array(w); // energy between column x-1 and x
  const ey = new Float64Array(h);
  for (let y = box.y0; y < box.y1; y++) {
    for (let x = box.x0; x < box.x1; x++) {
      const p = y * width + x;
      const here = mask[p];
      if (x > box.x0) {
        const q = p - 1;
        ex[x - box.x0] += edgeEnergy(mask[q] !== here, dist(data, p * 4, data, q * 4));
      }
      if (y > box.y0) {
        const q = p - width;
        ey[y - box.y0] += edgeEnergy(mask[q] !== here, dist(data, p * 4, data, q * 4));
      }
    }
  }
  // Energy is zero inside blocks, so real period `s` puts (nearly) all of it on one residue.
  const concentration = (e: Float64Array, s: number) => {
    const bucket = new Float64Array(s);
    let total = 0;
    for (let i = 1; i < e.length; i++) {
      bucket[i % s] += e[i];
      total += e[i];
    }
    if (total <= 0) return { score: 0, offset: 0 };
    let best = 0;
    let offset = 0;
    for (let r = 0; r < s; r++) {
      if (bucket[r] > best) {
        best = bucket[r];
        offset = r;
      }
    }
    return { score: best / total, offset };
  };

  const minDim = Math.min(w, h);
  for (let s = Math.min(maxBlock, Math.floor(minDim / 6)); s >= 2; s--) {
    const cx = concentration(ex, s);
    const cy = concentration(ey, s);
    // Both axes must agree on the period; 0.9 tolerates a little anti-aliasing / JPEG noise.
    // Scanning from large to small returns the largest passing size. Divisors of the true size
    // also concentrate (edges on multiples of 9 are also on multiples of 3), so "largest" is the
    // right pick; a size that is a multiple of the truth only passes when no edge falls inside
    // those bigger blocks, in which case sampling them is lossless anyway.
    if (cx.score >= 0.9 && cy.score >= 0.9) return { size: s, ox: cx.offset, oy: cy.offset };
  }
  return { size: 1, ox: 0, oy: 0 };
}

/** Median of a small number array (used to pick a robust colour per block). */
function median(values: number[]): number {
  values.sort((a, b) => a - b);
  return values[values.length >> 1];
}

export function extractPixelGrid(img: RGBAImage, options: GridOptions = {}): PixelGrid {
  const opts = { ...DEFAULTS, ...options };
  const { data, width, height } = img;
  const mask = foregroundMask(img, opts);
  const box = maskBounds(mask, width, height);
  if (!box) throw new Error('pixelGrid: no foreground found in the character image');

  const { size, ox, oy } = detectBlockSize(img, box, mask, opts.maxBlock);

  let gw: number;
  let gh: number;
  let sample: (cx: number, cy: number) => [number, number, number, number];

  if (size >= 2) {
    // Blocks are aligned to (box.x0 + ox) modulo size. Start at the first boundary at/below the box.
    const startX = box.x0 - ((((box.x0 - ox) % size) + size) % size);
    const startY = box.y0 - ((((box.y0 - oy) % size) + size) % size);
    gw = Math.ceil((box.x1 - startX) / size);
    gh = Math.ceil((box.y1 - startY) / size);
    sample = (cx, cy) => {
      const rs: number[] = [];
      const gs: number[] = [];
      const bs: number[] = [];
      let fg = 0;
      let n = 0;
      // Sample the inner part of the block, away from anti-aliased edges.
      const inset = size > 4 ? Math.floor(size * 0.25) : 0;
      for (let y = startY + cy * size + inset; y < startY + (cy + 1) * size - inset; y++) {
        for (let x = startX + cx * size + inset; x < startX + (cx + 1) * size - inset; x++) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          n++;
          const p = y * width + x;
          if (!mask[p]) continue;
          fg++;
          rs.push(data[p * 4]);
          gs.push(data[p * 4 + 1]);
          bs.push(data[p * 4 + 2]);
        }
      }
      if (n === 0 || fg * 2 < n) return [0, 0, 0, 0];
      return [median(rs), median(gs), median(bs), 255];
    };
  } else {
    // Not blocky: area-average down so the result still reads as chunky pixels.
    const bw = box.x1 - box.x0;
    const bh = box.y1 - box.y0;
    const scale = Math.max(1, bh / opts.maxRows);
    gw = Math.max(1, Math.round(bw / scale));
    gh = Math.max(1, Math.round(bh / scale));
    sample = (cx, cy) => {
      const x0 = box.x0 + Math.floor((cx * bw) / gw);
      const x1 = Math.max(x0 + 1, box.x0 + Math.floor(((cx + 1) * bw) / gw));
      const y0 = box.y0 + Math.floor((cy * bh) / gh);
      const y1 = Math.max(y0 + 1, box.y0 + Math.floor(((cy + 1) * bh) / gh));
      let r = 0;
      let g = 0;
      let b = 0;
      let fg = 0;
      let n = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          n++;
          const p = y * width + x;
          if (!mask[p]) continue;
          fg++;
          r += data[p * 4];
          g += data[p * 4 + 1];
          b += data[p * 4 + 2];
        }
      }
      if (n === 0 || fg * 2 < n) return [0, 0, 0, 0];
      return [r / fg, g / fg, b / fg, 255];
    };
  }

  const out = new Uint8ClampedArray(gw * gh * 4);
  for (let cy = 0; cy < gh; cy++) {
    for (let cx = 0; cx < gw; cx++) {
      const [r, g, b, a] = sample(cx, cy);
      const o = idx(cx, cy, gw);
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = a;
    }
  }
  return trimGrid({ width: gw, height: gh, rgba: out });
}

/** Drops fully transparent border rows/columns. */
export function trimGrid(grid: PixelGrid): PixelGrid {
  const { width, height, rgba } = grid;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[idx(x, y, width) + 3] === 0) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) throw new Error('pixelGrid: character image produced an empty grid');
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  if (w === width && h === height) return grid;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = idx(x + x0, y + y0, width);
      const d = idx(x, y, w);
      out[d] = rgba[s];
      out[d + 1] = rgba[s + 1];
      out[d + 2] = rgba[s + 2];
      out[d + 3] = rgba[s + 3];
    }
  }
  return { width: w, height: h, rgba: out };
}
