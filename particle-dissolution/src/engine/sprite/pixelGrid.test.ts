import { describe, expect, it } from 'vitest';
import { buildProceduralGrid } from './characterSprite';
import { extractPixelGrid, hasTransparency, type PixelGrid, type RGBAImage } from './pixelGrid';
import { mulberry32 } from '../rng';

/** Nearest-neighbour up-scale of a grid onto an opaque backdrop with a gradient and noise. */
function render(
  grid: PixelGrid,
  scale: number,
  pad: number,
  backdrop: 'transparent' | 'noisy-grey',
  seed = 7,
): RGBAImage {
  const rand = mulberry32(seed);
  const width = grid.width * scale + pad * 2;
  const height = grid.height * scale + pad * 2;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const gx = Math.floor((x - pad) / scale);
      const gy = Math.floor((y - pad) / scale);
      const inside = x >= pad && y >= pad && gx < grid.width && gy < grid.height;
      const cell = inside ? (gy * grid.width + gx) * 4 : -1;
      if (cell >= 0 && grid.rgba[cell + 3] > 0) {
        data[o] = grid.rgba[cell];
        data[o + 1] = grid.rgba[cell + 1];
        data[o + 2] = grid.rgba[cell + 2];
        data[o + 3] = 255;
      } else if (backdrop === 'transparent') {
        data[o + 3] = 0;
      } else {
        const g = 128 + (x / width) * 8 - (y / height) * 6 + (rand() - 0.5) * 6;
        data[o] = g;
        data[o + 1] = g;
        data[o + 2] = g + 2;
        data[o + 3] = 255;
      }
    }
  }
  return { data, width, height };
}

function sameGrid(a: PixelGrid, b: PixelGrid): number {
  expect(a.width).toBe(b.width);
  expect(a.height).toBe(b.height);
  let mismatches = 0;
  for (let i = 0; i < a.width * a.height; i++) {
    const o = i * 4;
    const av = a.rgba[o + 3] > 0;
    const bv = b.rgba[o + 3] > 0;
    if (av !== bv) mismatches++;
    else if (av && (Math.abs(a.rgba[o] - b.rgba[o]) > 3 || Math.abs(a.rgba[o + 1] - b.rgba[o + 1]) > 3)) {
      mismatches++;
    }
  }
  return mismatches;
}

describe('procedural sprite', () => {
  const sprite = buildProceduralGrid();

  it('has the expected silhouette and only opaque/transparent cells', () => {
    expect(sprite.height).toBeGreaterThan(40);
    let visible = 0;
    for (let i = 3; i < sprite.rgba.length; i += 4) {
      expect([0, 255]).toContain(sprite.rgba[i]);
      if (sprite.rgba[i] === 255) visible++;
    }
    expect(visible).toBeGreaterThan(350);
  });

  it('survives a round trip through a transparent PNG-style image', () => {
    const img = render(sprite, 9, 30, 'transparent');
    expect(hasTransparency(img)).toBe(true);
    expect(sameGrid(extractPixelGrid(img), sprite)).toBe(0);
  });

  it('survives a round trip through a noisy grey opaque backdrop (the supplied-art case)', () => {
    const img = render(sprite, 7, 41, 'noisy-grey');
    expect(hasTransparency(img)).toBe(false);
    expect(sameGrid(extractPixelGrid(img), sprite)).toBe(0);
  });

  it('works when the art is not up-scaled at all (1 px blocks)', () => {
    const img = render(sprite, 1, 6, 'noisy-grey');
    // Without blocks the flat-colour sprite is read directly (no detection needed).
    const out = extractPixelGrid(img);
    expect(out.width).toBe(sprite.width);
    expect(out.height).toBe(sprite.height);
  });

  it('downsamples a smooth, non-blocky image instead of failing', () => {
    const width = 400;
    const height = 700;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4;
        const dx = (x - 200) / 90;
        const dy = (y - 350) / 300;
        const inside = dx * dx + dy * dy < 1;
        data[o] = inside ? 60 + y / 8 : 120;
        data[o + 1] = inside ? 70 : 120;
        data[o + 2] = inside ? 90 : 120;
        data[o + 3] = 255;
      }
    }
    const grid = extractPixelGrid({ data, width, height }, { maxRows: 60 });
    expect(grid.height).toBeLessThanOrEqual(61);
    expect(grid.height).toBeGreaterThan(40);
  });

  it('rejects an image with no foreground', () => {
    const data = new Uint8ClampedArray(20 * 20 * 4).fill(128);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    expect(() => extractPixelGrid({ data, width: 20, height: 20 })).toThrow(/no foreground/);
  });
});
