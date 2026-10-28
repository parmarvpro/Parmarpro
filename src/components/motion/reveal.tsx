"use client";

import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/motion/motion-state";
import { cn } from "@/lib/utils";

/**
 * Fades and lifts content in as it scrolls into view. Content is visible in
 * the server-rendered HTML and is only hidden after hydration, and only when
 * it starts below the fold, so nothing flashes and nothing is lost without JS.
 */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion()) return;
    if (element.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    element.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          element.dataset.reveal = "shown";
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("reveal", className)} style={{ "--d": `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}
