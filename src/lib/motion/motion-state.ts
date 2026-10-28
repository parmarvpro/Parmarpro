"use client";

import { useSyncExternalStore } from "react";

/**
 * One place that decides whether ambient motion may run.
 * Motion is off when the visitor prefers reduced motion, asked for less data
 * (save-data), or pressed "Pause motion" (WCAG 2.2.2: moving content that
 * lasts more than five seconds needs a pause control).
 */

const PAUSE_KEY = "parmarpro.motion.paused";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const EVENT = "parmarpro:motion-change";

let paused = false;
let pausedLoaded = false;

function loadPaused(): boolean {
  if (!pausedLoaded) {
    pausedLoaded = true;
    try {
      paused = window.localStorage.getItem(PAUSE_KEY) === "1";
    } catch {
      paused = false;
    }
  }
  return paused;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia(REDUCED_QUERY).matches;
}

export function saveDataRequested(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

function reflectOnRoot(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.motion = enabled ? "on" : "off";
}

function computeEnabled(): boolean {
  const enabled = !prefersReducedMotion() && !saveDataRequested() && !loadPaused();
  reflectOnRoot(enabled);
  return enabled;
}

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(REDUCED_QUERY);
  const onStorage = (event: StorageEvent) => {
    if (event.key === PAUSE_KEY) {
      pausedLoaded = false;
      listener();
    }
  };
  media.addEventListener("change", listener);
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, listener);
  return () => {
    media.removeEventListener("change", listener);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, listener);
  };
}

/** True when ambient motion (loops, parallax, smooth scroll) is allowed. Server snapshot is true. */
export function useMotionEnabled(): boolean {
  return useSyncExternalStore(subscribe, computeEnabled, () => true);
}

/** True when the visitor pressed "Pause motion" (independent of the OS reduced-motion setting). */
export function useMotionPaused(): boolean {
  return useSyncExternalStore(subscribe, loadPaused, () => false);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

export function setMotionPaused(next: boolean): void {
  paused = next;
  pausedLoaded = true;
  try {
    window.localStorage.setItem(PAUSE_KEY, next ? "1" : "0");
  } catch {
    // Storage can be blocked; the pause still applies for this page view.
  }
  reflectOnRoot(computeEnabled());
  window.dispatchEvent(new Event(EVENT));
}
