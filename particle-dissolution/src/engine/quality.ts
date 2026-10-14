import { TIERS, type QualityTier } from './config';

/** Picks a particle/post tier from the device; `?q=low|medium|high|ultra` always wins. */
export function detectTier(search = typeof location === 'undefined' ? '' : location.search): QualityTier {
  const forced = new URLSearchParams(search).get('q');
  if (forced && forced in TIERS) return forced as QualityTier;

  if (typeof navigator === 'undefined') return 'medium';
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const small = typeof screen !== 'undefined' && Math.min(screen.width, screen.height) < 700;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;

  if (coarse || small) return cores >= 8 && mem >= 6 ? 'medium' : 'low';
  if (cores <= 4 || mem <= 4) return 'medium';
  return 'high';
}

/** `?n=` lets a developer pin an exact particle budget. */
export function particleOverride(
  search = typeof location === 'undefined' ? '' : location.search,
): number | null {
  const n = Number(new URLSearchParams(search).get('n'));
  return Number.isFinite(n) && n > 1000 ? n : null;
}
