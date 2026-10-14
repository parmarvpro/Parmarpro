import { GLOW, PALETTE_LIST, WORLD } from './config';
import { hexToRgb01, jitterHsl, mixRgb, type RGB } from './color';
import { clamp, gaussian, lerp, mulberry32, smoothstep } from './rng';

/**
 * Procedural crowd: dozens of abstract, softly blurred human silhouettes arranged in perspective
 * rows. Rows are defined in *screen space* (feet line + figure height as a fraction of the
 * viewport) and unprojected into the world through the final crowd camera, so the composition
 * holds for any aspect ratio.
 *
 * The output is a flat list of particle "slots" (rest position, colour, size, rig data). Nothing
 * here is animated: walking, bobbing and drift are done on the GPU from the rig attributes.
 */

/** Body-part ids shared with the vertex shader (`aRig.y`). */
export const PART = {
  torso: 0,
  head: 1,
  armL: 2,
  armR: 3,
  legL: 4,
  legR: 5,
  halo: 6,
} as const;

type Archetype = 'full' | 'coat' | 'smear';

export interface FigureInfo {
  index: number;
  row: number;
  archetype: Archetype;
  x: number;
  yFeet: number;
  z: number;
  height: number;
  count: number;
}

export interface CrowdSlots {
  count: number;
  /** Rest-pose world position, xyz per slot. */
  pos: Float32Array;
  /** Figure anchor: x, y(feet), z, height. */
  anchor: Float32Array;
  /** Rig: figure seed, part id, pivot x, pivot y (absolute rest coordinates). */
  rig: Float32Array;
  /** RGBA bytes: crowd colour + opacity multiplier. */
  color: Uint8Array;
  /** Particle diameter in world units. */
  size: Float32Array;
  /** 0 at a part's centre line, 1 at its silhouette edge. */
  edge: Float32Array;
  /** 0 = nearest row, 1 = farthest row. */
  depth: Float32Array;
  figures: FigureInfo[];
}

export interface CrowdOptions {
  count: number;
  aspect: number;
  seed: number;
}

interface Row {
  /** Distance from the (final) crowd camera. */
  dist: number;
  /** Normalised-device y of the feet line. */
  footNdc: number;
}

/**
 * Far → near. Heads climb the frame towards the horizon, the nearest row is large and slightly
 * cropped by the bottom edge, and the top of the frame stays open for the luminous background.
 */
const ROWS: readonly Row[] = [
  { dist: 60, footNdc: 0.36 },
  { dist: 50, footNdc: 0.24 },
  { dist: 42, footNdc: 0.1 },
  { dist: 35, footNdc: -0.08 },
  { dist: 29, footNdc: -0.3 },
  { dist: 24, footNdc: -0.56 },
  { dist: 20, footNdc: -0.88 },
];

const TAN_HALF_FOV = Math.tan((WORLD.fov * Math.PI) / 360);

/** Samples a point inside a unit ellipse (uniform). */
function ellipse(rand: () => number): [number, number] {
  const r = Math.sqrt(rand());
  const a = rand() * Math.PI * 2;
  return [Math.cos(a) * r, Math.sin(a) * r];
}

/** Triangular distribution on [-1, 1]: denser towards the centre line for soft edges. */
const tri = (rand: () => number) => rand() + rand() - 1;

interface FigureStyle {
  torso: RGB;
  legs: RGB;
  head: RGB;
  halo: RGB;
}

function pickStyle(rand: () => number, depth01: number): FigureStyle {
  const pal = PALETTE_LIST.map(hexToRgb01);
  const torso = pal[Math.floor(rand() * pal.length)];
  let legs = pal[Math.floor(rand() * pal.length)];
  // Keep the two colour blocks distinct so each figure reads as two forms.
  if (legs === torso) legs = pal[(pal.indexOf(torso) + 3) % pal.length];
  // Legs sit a little deeper in tone than the torso: gives each figure a clear top/bottom split.
  legs = mixRgb(legs, [0.18, 0.2, 0.32], 0.18);
  const head = mixRgb(torso, hexToRgb01(GLOW.cream), 0.45);
  const halo = mixRgb(torso, hexToRgb01(GLOW.cream), 0.35);
  // Aerial perspective: far figures are lighter and less saturated, near ones more saturated.
  const haze = hexToRgb01(GLOW.haze);
  const fog = Math.pow(smoothstep(0, 1, depth01), 1.15) * 0.52;
  const grade = (c: RGB) => {
    const sat = 1.1 - 0.3 * depth01;
    const g = (c[0] + c[1] + c[2]) / 3;
    const s: RGB = [g + (c[0] - g) * sat, g + (c[1] - g) * sat, g + (c[2] - g) * sat];
    return mixRgb(s, haze, fog);
  };
  return { torso: grade(torso), legs: grade(legs), head: grade(head), halo: grade(halo) };
}

export function generateCrowd({ count, aspect, seed }: CrowdOptions): CrowdSlots {
  const rand = mulberry32(seed ^ 0x9e3779b1);

  // ---- 1. place figures row by row ------------------------------------------------------------
  const placed: Omit<FigureInfo, 'count'>[] = [];
  const weights: number[] = [];
  ROWS.forEach((row, r) => {
    const halfH = row.dist * TAN_HALF_FOV; // world half-height visible at this distance
    const halfW = halfH * aspect;
    const figH = WORLD.figureHeight;
    // Tighter packing on narrow (portrait) viewports keeps the crowd feeling populous.
    const spacing = figH * lerp(0.4, 0.6, smoothstep(0.45, 1.3, aspect));
    const span = halfW * 2.36; // a little beyond the frame so drift/parallax never reveal gaps
    const n = Math.max(2, Math.round(span / spacing));
    const stagger = rand() * spacing;
    for (let i = 0; i < n; i++) {
      const jitter = (rand() - 0.5) * 0.75;
      const x = -span / 2 + stagger * 0.5 + (i + 0.5 + jitter) * (span / n);
      const dist = row.dist + (rand() - 0.5) * 2.2;
      const hScale = 0.9 + rand() * 0.24;
      const footNdc = row.footNdc + (rand() - 0.5) * 0.05;
      const rowHalfH = dist * TAN_HALF_FOV;
      // Near rows favour complete figures (head, arms, legs); far rows are looser, more abstract forms.
      const nearness = r / (ROWS.length - 1);
      const a = rand();
      const fullP = lerp(0.4, 0.78, nearness);
      const smearP = lerp(0.35, 0.05, nearness);
      const archetype: Archetype = a < fullP ? 'full' : a < fullP + smearP ? 'smear' : 'coat';
      placed.push({
        index: placed.length,
        row: r,
        archetype,
        x,
        yFeet: WORLD.crowdCamY + footNdc * rowHalfH,
        z: WORLD.crowdCamDist - dist,
        height: figH * hScale,
      });
      // Particle share ~ on-screen area (height²), so density per pixel stays even across depth.
      weights.push(Math.pow((figH * hScale) / rowHalfH, 2) * (0.7 + rand() * 0.6));
    }
  });

  // ---- 2. allocate particles ---------------------------------------------------------------------
  const minPer = 36;
  const totalW = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.max(minPer, Math.floor((count * w) / totalW)));
  let sum = counts.reduce((a, b) => a + b, 0);
  // Fix rounding / floor drift so the total is exactly `count` (largest figures absorb the diff).
  const order = counts.map((_, i) => i).sort((a, b) => weights[b] - weights[a]);
  for (let k = 0; sum !== count; k = (k + 1) % order.length) {
    const i = order[k];
    if (sum < count) {
      counts[i]++;
      sum++;
    } else if (counts[i] > minPer) {
      counts[i]--;
      sum--;
    }
  }

  // ---- 3. sample every figure ------------------------------------------------------------------
  const pos = new Float32Array(count * 3);
  const anchor = new Float32Array(count * 4);
  const rig = new Float32Array(count * 4);
  const color = new Uint8Array(count * 4);
  const size = new Float32Array(count);
  const edge = new Float32Array(count);
  const depthOut = new Float32Array(count);
  const figures: FigureInfo[] = [];

  let w = 0; // write cursor
  placed.forEach((fig, fi) => {
    const n = counts[fi];
    const depth01 = 1 - fig.row / (ROWS.length - 1); // row 0 (far) → 1, nearest → 0
    const style = pickStyle(rand, depth01);
    const H = fig.height;
    const seedF = fi + 1;
    const dist = WORLD.crowdCamDist - fig.z;
    const worldPerNdc = dist * TAN_HALF_FOV;
    // Per-particle diameter from the figure's screen area, so coverage is even yet still soft.
    const figWidthNdc = (H * 0.32) / (worldPerNdc * aspect);
    const figHeightNdc = H / worldPerNdc;
    const areaNdc = Math.max(1e-6, figWidthNdc * figHeightNdc * 0.62);
    // Foreground particles are deliberately larger on screen (bokeh-like), background ones finer.
    const depthSizeMul = lerp(1.2, 0.64, depth01);
    const baseSize = Math.sqrt(areaNdc / n) * worldPerNdc * 1.9 * depthSizeMul;

    // Part budget per archetype.
    const haloFrac = lerp(0.17, 0.05, depth01);
    const shares =
      fig.archetype === 'full'
        ? { head: 0.1, torso: 0.36, legs: 0.28, arms: 0.12 }
        : fig.archetype === 'coat'
          ? { head: 0.1, torso: 0.52, legs: 0.14, arms: 0.05 }
          : { head: 0.09, torso: 0.8, legs: 0, arms: 0 };
    const norm = (1 - haloFrac) / (shares.head + shares.torso + shares.legs + shares.arms);
    const nHead = Math.round(n * shares.head * norm);
    const nTorso = Math.round(n * shares.torso * norm);
    const nLegs = Math.round(n * shares.legs * norm);
    const nArms = Math.round(n * shares.arms * norm);
    const nHalo = Math.max(0, n - nHead - nTorso - nLegs - nArms);

    const lean = (rand() - 0.5) * 0.02;
    const hipY = fig.archetype === 'coat' ? 0.3 : 0.52;

    const push = (
      part: number,
      lx: number,
      ly: number,
      lz: number,
      col: RGB,
      edgeV: number,
      sizeMul: number,
      opacity: number,
      pivotX: number,
      pivotY: number,
      shadeU = 0,
    ) => {
      const o3 = w * 3;
      const o4 = w * 4;
      pos[o3] = fig.x + lx * H;
      pos[o3 + 1] = fig.yFeet + ly * H;
      pos[o3 + 2] = fig.z + lz;
      anchor[o4] = fig.x;
      anchor[o4 + 1] = fig.yFeet;
      anchor[o4 + 2] = fig.z;
      anchor[o4 + 3] = H;
      rig[o4] = seedF;
      rig[o4 + 1] = part;
      rig[o4 + 2] = fig.x + pivotX * H;
      rig[o4 + 3] = fig.yFeet + pivotY * H;
      // Painterly variation: tiny hue/lightness drift per particle.
      // light from the upper left: a gentle gradient across each part gives volume without detail
      const c = jitterHsl(
        col,
        (rand() - 0.5) * 0.02,
        (rand() - 0.5) * 0.08,
        (rand() - 0.5) * 0.06 - shadeU * 0.045 + (ly - 0.5) * 0.03,
      );
      color[o4] = Math.round(clamp(c[0], 0, 1) * 255);
      color[o4 + 1] = Math.round(clamp(c[1], 0, 1) * 255);
      color[o4 + 2] = Math.round(clamp(c[2], 0, 1) * 255);
      color[o4 + 3] = Math.round(clamp(opacity, 0, 1) * 255);
      size[w] = baseSize * sizeMul * (0.85 + rand() * 0.3);
      edge[w] = edgeV;
      depthOut[w] = depth01;
      w++;
    };

    const baseOpacity = lerp(0.62, 0.82, depth01);
    const thickness = H * 0.03;

    // Head: small compact ellipse above the shoulders.
    for (let i = 0; i < nHead; i++) {
      const [ex, ey] = ellipse(rand);
      const e = Math.hypot(ex, ey);
      push(
        PART.head,
        lean * 3 + ex * 0.056,
        0.915 + ey * 0.066,
        gaussian(rand) * thickness,
        style.head,
        e,
        0.85,
        baseOpacity + 0.1,
        0,
        hipY,
        ex,
      );
    }

    // Torso: tapering trapezoid with rounded shoulders; coat extends down to the knees.
    const torsoBottom = fig.archetype === 'coat' ? 0.3 : fig.archetype === 'smear' ? 0.03 : 0.5;
    for (let i = 0; i < nTorso; i++) {
      const y = lerp(torsoBottom, 0.84, rand());
      const t = smoothstep(torsoBottom, 0.8, y);
      let hw =
        fig.archetype === 'smear'
          ? lerp(0.09, 0.115, t)
          : fig.archetype === 'coat'
            ? lerp(0.15, 0.118, t)
            : lerp(0.082, 0.118, t);
      if (y > 0.8) hw *= Math.sqrt(Math.max(0, 1 - Math.pow((y - 0.8) / 0.045, 2)));
      const u = tri(rand);
      push(
        PART.torso,
        lean * (y * 2) + u * hw,
        y,
        gaussian(rand) * thickness,
        style.torso,
        Math.abs(u),
        1,
        baseOpacity,
        0,
        hipY,
        u,
      );
    }

    // Legs (two capsules, pivot at the hips).
    for (let i = 0; i < nLegs; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const legTop = hipY;
      const y = lerp(0.02, legTop, rand());
      const t = (y - 0.02) / (legTop - 0.02); // 0 ankle → 1 hip
      const cx = side * lerp(0.058, 0.04, t);
      const hw = lerp(0.026, 0.036, t);
      const u = tri(rand);
      push(
        side < 0 ? PART.legL : PART.legR,
        cx + u * hw,
        y,
        gaussian(rand) * thickness,
        style.legs,
        Math.abs(u),
        0.92,
        baseOpacity,
        side * 0.04,
        legTop,
        u,
      );
    }

    // Arms (slim capsules hanging from the shoulders, pivot at the shoulder).
    for (let i = 0; i < nArms; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const y = lerp(0.5, 0.82, rand());
      const t = (y - 0.5) / 0.32; // 0 hand → 1 shoulder
      const cx = side * lerp(0.152, 0.128, t);
      const u = tri(rand);
      push(
        side < 0 ? PART.armL : PART.armR,
        cx + u * 0.03,
        y,
        thickness * 2.5 + gaussian(rand) * thickness,
        style.torso,
        Math.abs(u),
        0.82,
        baseOpacity,
        side * 0.125,
        0.82,
        u,
      );
    }

    // Halo: large, faint colour cloud behind the body (reads as the figure's soft glow).
    for (let i = 0; i < nHalo; i++) {
      push(
        PART.halo,
        gaussian(rand) * 0.17,
        0.58 + gaussian(rand) * 0.3,
        -H * 0.05 + gaussian(rand) * thickness * 2,
        style.halo,
        1,
        2.4,
        baseOpacity * 0.34,
        0,
        hipY,
      );
    }

    figures.push({ ...fig, count: n });
  });

  if (w !== count) throw new Error(`crowd: wrote ${w} slots, expected ${count}`);
  return { count, pos, anchor, rig, color, size, edge, depth: depthOut, figures };
}
