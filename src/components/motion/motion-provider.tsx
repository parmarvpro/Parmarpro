"use client";

import { useEffect } from "react";

import { loadGsap, whenIdle } from "@/lib/motion/gsap";
import { useMotionEnabled } from "@/lib/motion/motion-state";
import { trackScrollVelocity } from "@/lib/motion/scroll-velocity";

/**
 * Starts smooth scrolling and scroll-linked animation for marketing pages.
 * Everything here is optional polish: the page is fully usable without it.
 * It is skipped for reduced motion, save-data and when motion is paused, and
 * smooth scrolling is only used with a fine pointer (never on touch screens).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const enabled = useMotionEnabled();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let teardown: (() => void) | null = null;
    const stopVelocity = trackScrollVelocity();

    const cancelIdle = whenIdle(() => {
      void (async () => {
        const [{ gsap, ScrollTrigger }, { default: Lenis }] = await Promise.all([loadGsap(), import("lenis")]);
        if (cancelled) return;

        let lenis: InstanceType<typeof Lenis> | null = null;
        let tick: ((time: number) => void) | null = null;
        if (window.matchMedia("(pointer: fine)").matches) {
          lenis = new Lenis({
            duration: 1.15,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
          });
          lenis.on("scroll", ScrollTrigger.update);
          tick = (time: number) => lenis?.raf(time * 1000);
          gsap.ticker.add(tick);
          gsap.ticker.lagSmoothing(0);
        }

        void document.fonts?.ready.then(() => ScrollTrigger.refresh());

        teardown = () => {
          if (tick) gsap.ticker.remove(tick);
          lenis?.destroy();
        };
      })();
    });

    return () => {
      cancelled = true;
      cancelIdle();
      stopVelocity();
      teardown?.();
    };
  }, [enabled]);

  return <>{children}</>;
}
