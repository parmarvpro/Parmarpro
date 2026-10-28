"use client";

/**
 * Smoothed scroll velocity in CSS px per millisecond (positive = scrolling down).
 * Works with or without smooth-scroll, and only runs while someone subscribes.
 */

let velocity = 0;
let subscribers = 0;
let stopListening: (() => void) | null = null;

export function getScrollVelocity(): number {
  return velocity;
}

function listen(): () => void {
  let lastY = window.scrollY;
  let lastT = performance.now();
  let raf = 0;
  let decaying = false;

  const decay = () => {
    velocity *= 0.9;
    if (Math.abs(velocity) < 0.0004) {
      velocity = 0;
      decaying = false;
      return;
    }
    raf = requestAnimationFrame(decay);
  };

  const onScroll = () => {
    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    const instant = (window.scrollY - lastY) / dt;
    velocity += (instant - velocity) * 0.3;
    lastY = window.scrollY;
    lastT = now;
    if (!decaying) {
      decaying = true;
      raf = requestAnimationFrame(decay);
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.removeEventListener("scroll", onScroll);
    cancelAnimationFrame(raf);
    velocity = 0;
  };
}

/** Start tracking; returns a function that stops it. Safe to call from several components. */
export function trackScrollVelocity(): () => void {
  subscribers += 1;
  if (subscribers === 1) stopListening = listen();
  return () => {
    subscribers -= 1;
    if (subscribers === 0) {
      stopListening?.();
      stopListening = null;
    }
  };
}
