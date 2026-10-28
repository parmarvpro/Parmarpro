"use client";

import { PauseIcon, PlayIcon } from "lucide-react";

import { setMotionPaused, useMotionPaused, useReducedMotion } from "@/lib/motion/motion-state";
import { cn } from "@/lib/utils";

/**
 * Pause control for ambient motion (WCAG 2.2.2). Hidden when the device
 * already asks for reduced motion, because nothing is moving then.
 */
export function PauseMotion({ className }: { className?: string }) {
  const paused = useMotionPaused();
  const reduced = useReducedMotion();
  if (reduced) return null;
  const Icon = paused ? PlayIcon : PauseIcon;
  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={() => setMotionPaused(!paused)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white/90 px-3 py-1.5 text-xs font-semibold tracking-[0.06em] text-ink-700 uppercase transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:outline-none",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {paused ? "Play motion" : "Pause motion"}
    </button>
  );
}
