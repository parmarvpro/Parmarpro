import { buildProceduralGrid } from './characterSprite';
import { extractPixelGrid, type GridOptions, type PixelGrid } from './pixelGrid';

export interface LoadedCharacter {
  grid: PixelGrid;
  /** `image` when the supplied art was found and parsed, otherwise the built-in sprite. */
  source: 'image' | 'procedural';
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load character image: ${src}`));
    img.src = src;
  });
}

/**
 * Loads the supplied pixel-art character (alpha or flat-backdrop PNG/JPG/WebP) and converts it to a
 * cell grid. Any failure — missing file, undecodable data, empty mask — falls back to the
 * hand-authored procedural sprite so the experience always starts.
 */
export async function loadCharacter(
  src: string | null | undefined,
  options?: GridOptions,
): Promise<LoadedCharacter> {
  if (src) {
    try {
      const img = await loadImage(src);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('2D canvas unavailable');
      // Nearest-neighbour: never smooth the art while reading it back.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return { grid: extractPixelGrid({ data, width, height }, options), source: 'image' };
    } catch (err) {
      console.warn('[dissolve] falling back to the procedural character:', err);
    }
  }
  return { grid: buildProceduralGrid(), source: 'procedural' };
}
