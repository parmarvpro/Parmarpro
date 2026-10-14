import type { ExperienceInfo, ExperienceStatus } from './Experience';

/** Deterministic-capture hook, only installed when the page is opened with `?debug`. */
export interface DissolveDebug {
  /** Pin progress (0–1), heading (0 → crowd, 1 → character) and scene time, then render one frame. */
  freeze(progress: number, dir: number, time?: number): void;
  release(): void;
  status(): ExperienceStatus;
  info: ExperienceInfo;
}

declare global {
  interface Window {
    __dissolve?: DissolveDebug;
  }
}
