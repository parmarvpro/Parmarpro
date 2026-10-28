import { useId } from "react";

import { cn } from "@/lib/utils";

const STAR = "M50 0C53 36 64 47 100 50C64 53 53 64 50 100C47 64 36 53 0 50C36 47 47 36 50 0Z";

/** Four-point sparkle with a dotted halo, the ParmarPro "clean smile" motif. Decorative. */
export function Sparkle({ className, tone = "blue" }: { className?: string; tone?: "blue" | "white" }) {
  const id = useId().replace(/:/g, "");
  const solid = tone === "blue" ? ["#0d47e6", "#5b87ff"] : ["#ffffff", "#dce6ff"];
  const dot = tone === "blue" ? "#1f5bff" : "#ffffff";
  return (
    <svg viewBox="-20 -20 140 140" aria-hidden="true" className={cn("pointer-events-none select-none", className)}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={solid[0]} />
          <stop offset="1" stopColor={solid[1]} />
        </linearGradient>
        <pattern id={`${id}-dots`} width="3.2" height="3.2" patternUnits="userSpaceOnUse">
          <circle cx="1.6" cy="1.6" r="0.9" fill={dot} />
        </pattern>
        <radialGradient id={`${id}-fade`}>
          <stop offset="0.35" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-mask`}>
          <rect x="-20" y="-20" width="140" height="140" fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <path d={STAR} transform="translate(50 50) scale(1.32) translate(-50 -50)" fill={`url(#${id}-dots)`} mask={`url(#${id}-mask)`} />
      <path d={STAR} fill={`url(#${id}-fill)`} />
    </svg>
  );
}
