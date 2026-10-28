"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

/** Tilts its content a few degrees toward the mouse (max 6°). Mouse only; flat for touch and reduced motion. */
export function Tilt({ children, className, max = 6 }: { children: React.ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || event.pointerType !== "mouse" || document.documentElement.dataset.motion === "off") return;
    const rect = element.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    element.style.transition = "transform 0.08s linear";
    element.style.transform = `perspective(1100px) rotateX(${(-py * max * 2).toFixed(2)}deg) rotateY(${(px * max * 2).toFixed(2)}deg)`;
  };

  const leave = () => {
    const element = ref.current;
    if (!element) return;
    element.style.transition = "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)";
    element.style.transform = "";
  };

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={cn("will-change-transform", className)}>
      {children}
    </div>
  );
}
