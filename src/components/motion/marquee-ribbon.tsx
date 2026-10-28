"use client";

import { useEffect, useRef } from "react";

import { Sparkle } from "@/components/brand/sparkle";
import { useMotionEnabled } from "@/lib/motion/motion-state";
import { getScrollVelocity } from "@/lib/motion/scroll-velocity";

// Only things ParmarPro really does.
const ROW_ONE = ["Inquiries", "Follow-ups", "Appointments", "Tasks", "Teams"];
const ROW_TWO = ["Leads", "Patients", "Roles", "Dashboard", "Activity"];

function Group({ words, outline, hidden }: { words: string[]; outline?: boolean; hidden?: boolean }) {
  return (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {words.map((word) => (
        <span key={word} className="flex items-center gap-6 pr-6 sm:gap-10 sm:pr-10">
          <span className={`headline whitespace-nowrap text-[clamp(2.5rem,9vw,7.5rem)] ${outline ? "outline-text" : "text-brand-500"}`}>{word}</span>
          <Sparkle tone="blue" className="size-7 shrink-0 sm:size-10" />
        </span>
      ))}
    </div>
  );
}

/**
 * Two huge rows of words, moving in opposite directions. Scroll speed skews
 * them (one row leans one way, the other row leans the other way). Decorative.
 */
export function MarqueeRibbon({ className }: { className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const enabled = useMotionEnabled();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;
    const hosts = Array.from(root.querySelectorAll<HTMLElement>("[data-skew]"));
    let raf = 0;
    let visible = false;
    let current = 0;

    const tick = () => {
      raf = 0;
      if (!visible) return;
      const target = Math.max(-6, Math.min(6, getScrollVelocity() * 3));
      current += (target - current) * 0.12;
      hosts.forEach((host, index) => {
        host.style.transform = `skewX(${(index % 2 === 0 ? current : -current).toFixed(2)}deg)`;
      });
      raf = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible && !raf) raf = requestAnimationFrame(tick);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      hosts.forEach((host) => {
        host.style.transform = "";
      });
    };
  }, [enabled]);

  return (
    <div ref={rootRef} aria-hidden="true" className={`overflow-hidden py-2 select-none ${className ?? ""}`}>
      <div data-skew className="will-change-transform">
        <div className="marquee-track">
          <Group words={ROW_ONE} />
          <Group words={ROW_ONE} hidden />
        </div>
      </div>
      <div data-skew className="mt-1 will-change-transform sm:mt-3">
        <div className="marquee-track" data-direction="reverse">
          <Group words={ROW_TWO} outline />
          <Group words={ROW_TWO} outline hidden />
        </div>
      </div>
    </div>
  );
}
