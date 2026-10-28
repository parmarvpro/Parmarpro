"use client";

import { useRef } from "react";

/** Pulls its child a few pixels toward the mouse. Mouse only, at most 8 px, springs back on leave. */
export function Magnetic({ children, className }: { children: React.ReactNode; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    const inner = innerRef.current;
    if (!host || !inner || event.pointerType !== "mouse") return;
    const rect = host.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) * 0.22;
    const dy = (event.clientY - (rect.top + rect.height / 2)) * 0.22;
    inner.style.transition = "none";
    inner.style.transform = `translate3d(${Math.max(-8, Math.min(8, dx))}px, ${Math.max(-8, Math.min(8, dy))}px, 0)`;
  };

  const leave = () => {
    const inner = innerRef.current;
    if (!inner) return;
    inner.style.transition = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";
    inner.style.transform = "";
  };

  return (
    <div ref={hostRef} onPointerMove={move} onPointerLeave={leave} className={`-m-5 inline-block p-5 ${className ?? ""}`}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
