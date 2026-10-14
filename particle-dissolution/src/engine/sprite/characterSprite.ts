/**
 * Procedural fallback for the pixel-art character.
 *
 * The production art is expected at `public/assets/character.png` (see README). When that file is
 * absent the experience renders this hand-authored sprite instead, built from the written brief:
 * black messy hair, small tan face, dark charcoal T-shirt with a tiny white chest detail, dark grey
 * trousers, black shoes, side-facing, compact upright stance with the arms relaxed at the sides.
 *
 * One character = one cell. `.` is transparent. Rows are padded to the widest row.
 */

import { trimGrid, type PixelGrid } from './pixelGrid';

export interface SpriteCell {
  r: number;
  g: number;
  b: number;
}

/** Legend: sRGB hex per glyph. */
export const SPRITE_PALETTE: Readonly<Record<string, string>> = {
  K: '#0b0b0e', // hair (near black)
  k: '#1f2026', // hair, lifted strand
  T: '#d8a06b', // skin, tan
  t: '#b9814e', // skin, shade (ear, jaw, forearm edge)
  E: '#17110e', // eye
  S: '#34363c', // T-shirt, dark charcoal
  s: '#25272c', // T-shirt, shade / sleeve seam
  W: '#eeeeea', // chest detail
  P: '#4c4f57', // trousers, dark grey
  p: '#393c43', // trousers, shade
  B: '#0d0d10', // shoes
  b: '#2a2b31', // shoe sole
};

export const SPRITE_ROWS: readonly string[] = [
  '......K.K..K.K',
  '.....KKKKKKKKK',
  '....KKkKKKKKKKKK',
  '...KKKKKKkKKKKKKK',
  '...KKkKKKKKKKKKKK',
  '...KKKKKKKKKKTTT',
  '...KKKKKKKKKkTTT',
  '...KKKKKKKKKKTET',
  '...KKKKKKKttTTTTT',
  '...KKKKKKKtTTTTT',
  '....KKKKKKTTTtT',
  '.....KKKKKTTTt',
  '......KKKTTTt',
  '......SSSTTTSSS',
  '.....SSSSSSSSSSS',
  '.....SSsSSSsSSSS',
  '.....SSsSSSsSWWS',
  '.....SSsSSSsSWWS',
  '.....SSsssssSSSS',
  '.....SSSTTtSSSSS',
  '.....SSSTTtSSSSS',
  '.....SSSTTtSSSSS',
  '.....SSSTTtSSSSS',
  '.....SSSTTtSSSSS',
  '.....SSSTTtSSSSS',
  '......SSTTTtSSS',
  '......SSSssSSSs',
  '......ppppppppp',
  '......PPPPPPppp',
  '......PPPPPPppp',
  '......PPPPPPppp',
  '......PPPPPsppp',
  '......PPPPPsppp',
  '......PPPPPsppp',
  '......PPPPPsppp',
  '......PPPPPsppp',
  '......PPPPPsppp',
  '......PPPPPsppp',
  '......PPPPPsppp',
  '......PPPPPsppp',
  '......PPPPPsppp',
  '......ppppsppp',
  '......BBBBBBBBB',
  '......BBBBBBBBBB',
  '......BBBBBBBBBBB',
  '......bbbbbbbbbbb',
];

/** Hex (`#rrggbb`) to 8-bit channels. */
export function hexToRgb(hex: string): SpriteCell {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

/**
 * Rasterises the ASCII sprite into the same {@link PixelGrid} shape the image loader produces
 * (transparent border trimmed, so both sources are interchangeable downstream).
 */
export function buildProceduralGrid(): PixelGrid {
  const width = Math.max(...SPRITE_ROWS.map((r) => r.length));
  const height = SPRITE_ROWS.length;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const lut = new Map<string, SpriteCell>();
  for (const [glyph, hex] of Object.entries(SPRITE_PALETTE)) lut.set(glyph, hexToRgb(hex));

  SPRITE_ROWS.forEach((row, y) => {
    for (let x = 0; x < width; x++) {
      const c = lut.get(row[x] ?? '.');
      if (!c) continue; // '.' or unknown -> transparent
      const o = (y * width + x) * 4;
      rgba[o] = c.r;
      rgba[o + 1] = c.g;
      rgba[o + 2] = c.b;
      rgba[o + 3] = 255;
    }
  });
  return trimGrid({ width, height, rgba });
}
