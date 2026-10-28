/**
 * Counter-flow: three blocks in a line. The outer two move together; the
 * middle one moves the exact opposite way. This file is the single source of
 * truth for that rule, so the shader, the card columns and the scroll
 * parallax can never disagree. It has no DOM or WebGL dependency.
 */

export const PANEL_COUNT = 3 as const;
export type PanelIndex = 0 | 1 | 2;

/** +1 = flows up, -1 = flows down. Left and right match; the middle is the opposite. */
export const FLOW_DIRECTIONS = [1, -1, 1] as const;

/** The middle block sits this many CSS px lower than its neighbours. */
export const MIDDLE_OFFSET_PX = 28;

export function flowDirection(index: PanelIndex): 1 | -1 {
  return FLOW_DIRECTIONS[index];
}

export type PanelTone = "blue" | "paper";

/** The outer blocks are blue with light dots; the middle inverts to paper with blue dots. */
export function panelTone(index: PanelIndex): PanelTone {
  return index === 1 ? "paper" : "blue";
}

/** CSS `animation-direction` for a card column that scrolls toward -Y (up) by default. */
export function columnAnimationDirection(index: PanelIndex): "normal" | "reverse" {
  return flowDirection(index) === 1 ? "normal" : "reverse";
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Scroll parallax for a hero panel: outer −a → +a, middle +a → −a as progress goes 0 → 1. */
export function parallaxYPercent(index: PanelIndex, progress: number, amplitude = 6): number {
  const centred = clamp01(progress) * 2 - 1;
  return flowDirection(index) * amplitude * centred;
}

/** Step-card offset in px: outer +a → −a, middle −a → +a; every card is aligned at progress 0.5. */
export function stepCardOffset(index: PanelIndex, progress: number, amplitude = 48): number {
  const centred = clamp01(progress) * 2 - 1;
  return -flowDirection(index) * amplitude * centred;
}

export type PanelRect = { x: number; width: number };

/** Horizontal layout of the three panels inside `totalWidth` with `gutter` between them. */
export function panelLayout(totalWidth: number, gutter: number): [PanelRect, PanelRect, PanelRect] {
  const width = (totalWidth - gutter * (PANEL_COUNT - 1)) / PANEL_COUNT;
  const pitch = width + gutter;
  return [
    { x: 0, width },
    { x: pitch, width },
    { x: pitch * 2, width },
  ];
}

export type PanelHit = { panel: PanelIndex; inGutter: boolean; localX: number };

/** CPU mirror of how the fragment shader decides which panel an x coordinate belongs to. */
export function panelAtX(x: number, totalWidth: number, gutter: number): PanelHit {
  const [first] = panelLayout(totalWidth, gutter);
  const pitch = first.width + gutter;
  const panel = Math.min(2, Math.max(0, Math.floor(x / pitch))) as PanelIndex;
  const localX = x - panel * pitch;
  return { panel, inGutter: localX > first.width, localX };
}

export type FieldColors = { base: string; low: string; mid: string; high: string };

/** Brand-scale tones for the dot field (see docs/design-system.md). */
export const FIELD_COLORS: Record<PanelTone, FieldColors> = {
  blue: { base: "#1f5bff", low: "#1647d6", mid: "#8eadff", high: "#eef3ff" },
  paper: { base: "#eef3ff", low: "#d3e0ff", mid: "#5b87ff", high: "#1f5bff" },
};

/** "#rrggbb" → [r, g, b] in 0..1, for shader uniforms. */
export function hexToRgb01(hex: string): [number, number, number] {
  const value = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) throw new Error(`not a 6-digit hex colour: ${hex}`);
  return [parseInt(value.slice(0, 2), 16) / 255, parseInt(value.slice(2, 4), 16) / 255, parseInt(value.slice(4, 6), 16) / 255];
}
