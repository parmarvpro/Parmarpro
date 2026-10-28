"use client";

import { useEffect, useRef } from "react";

import { stepCardOffset, type PanelIndex } from "@/lib/motion/counter-flow";
import { loadGsap } from "@/lib/motion/gsap";
import { useMotionEnabled } from "@/lib/motion/motion-state";

/**
 * The 01 / 02 / 03 row. As it crosses the screen the outer cards slide one way
 * and the middle card slides the opposite way, lining up at the centre.
 * Only on layouts where the cards sit side by side (stacked cards would collide).
 */
export function StepRow({ children, className }: { children: React.ReactNode; className?: string }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const enabled = useMotionEnabled();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let teardown: (() => void) | undefined;
    void loadGsap().then(({ gsap }) => {
      const row = rowRef.current;
      if (cancelled || !row) return;
      const media = gsap.matchMedia();
      media.add("(min-width: 768px)", () => {
        gsap.utils.toArray<HTMLElement>("[data-step]", row).forEach((card) => {
          const index = Number(card.dataset.step) as PanelIndex;
          gsap.fromTo(
            card,
            { y: stepCardOffset(index, 0) },
            {
              y: stepCardOffset(index, 1),
              ease: "none",
              scrollTrigger: { trigger: row, start: "top bottom", end: "bottom top", scrub: 0.6 },
            },
          );
        });
      });
      teardown = () => media.revert();
    });
    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [enabled]);

  return (
    <div ref={rowRef} className={className}>
      {children}
    </div>
  );
}
