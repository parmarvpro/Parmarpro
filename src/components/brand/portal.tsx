import { useId } from "react";

import { cn } from "@/lib/utils";

/** A standing door/portal on a curved ground, drawn in the brand blues. Decorative. */
export function Portal({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 240 240" aria-hidden="true" className={cn("pointer-events-none select-none", className)}>
      <defs>
        <linearGradient id={`${id}-slab`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0b38b4" />
          <stop offset="1" stopColor="#1f5bff" />
        </linearGradient>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#bacdff" />
        </linearGradient>
        <radialGradient id={`${id}-ground`} cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#dce6ff" stopOpacity="0.9" />
          <stop offset="0.55" stopColor="#8eadff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#8eadff" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-dots`} width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.05" fill="#ffffff" />
        </pattern>
      </defs>
      <ellipse cx="130" cy="196" rx="118" ry="30" fill={`url(#${id}-ground)`} />
      <path d="M96 60L160 38V176L96 186Z" fill={`url(#${id}-slab)`} />
      <path d="M104 70L152 54V168L104 176Z" fill={`url(#${id}-light)`} />
      <path d="M104 70L152 54V168L104 176Z" fill={`url(#${id}-dots)`} opacity="0.35" />
      <path d="M160 38L172 44V178L160 176Z" fill="#081c55" opacity="0.85" />
      <ellipse cx="132" cy="190" rx="52" ry="6" fill="#050e2b" opacity="0.18" />
    </svg>
  );
}
