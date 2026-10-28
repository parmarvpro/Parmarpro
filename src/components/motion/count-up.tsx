"use client";

import { useEffect, useRef } from "react";

import { useMotionEnabled } from "@/lib/motion/motion-state";

const format = new Intl.NumberFormat("en-IN");

/**
 * A number that counts up once when it scrolls into view. The server HTML
 * already contains the final value, so it is correct without JavaScript and
 * for search engines; the count only replays it visually.
 */
export function CountUp({ to, prefix = "", durationMs = 1400 }: { to: number; prefix?: string; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const enabled = useMotionEnabled();

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    let raf = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(2, -10 * t);
          element.textContent = `${prefix}${format.format(Math.round(to * (t === 1 ? 1 : eased)))}`;
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      element.textContent = `${prefix}${format.format(to)}`;
    };
  }, [enabled, to, prefix, durationMs]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {format.format(to)}
    </span>
  );
}
