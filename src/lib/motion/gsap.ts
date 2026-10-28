"use client";

type GsapModule = typeof import("gsap");
type ScrollTriggerModule = typeof import("gsap/ScrollTrigger");

export type GsapKit = { gsap: GsapModule["gsap"]; ScrollTrigger: ScrollTriggerModule["ScrollTrigger"] };

let kit: Promise<GsapKit> | null = null;

/**
 * Loads GSAP and ScrollTrigger once, after hydration, so the animation code
 * never sits in the first-load bundle. Safe to call from many components.
 */
export function loadGsap(): Promise<GsapKit> {
  kit ??= Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([core, scroll]) => {
    core.gsap.registerPlugin(scroll.ScrollTrigger);
    return { gsap: core.gsap, ScrollTrigger: scroll.ScrollTrigger };
  });
  return kit;
}

/** Run `task` when the browser is idle (or shortly after, where requestIdleCallback is missing). */
export function whenIdle(task: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(task, 200);
  return () => window.clearTimeout(id);
}
