"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

/** A card with a soft spotlight and glowing border that follow the mouse. Mouse only; harmless elsewhere. */
export function SpotlightTile({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || event.pointerType !== "mouse" || frame.current) return;
    const { clientX, clientY } = event;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const rect = element.getBoundingClientRect();
      element.style.setProperty("--mx", `${clientX - rect.left}px`);
      element.style.setProperty("--my", `${clientY - rect.top}px`);
    });
  };

  return (
    <div ref={ref} onPointerMove={onPointerMove} className={cn("spotlight rounded-2xl border bg-white", className)}>
      {children}
    </div>
  );
}
