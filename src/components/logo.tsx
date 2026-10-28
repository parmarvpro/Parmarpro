import Link from "next/link";

import { cn } from "@/lib/utils";

const TOOTH =
  "M10 9.5c2.2-1.3 4-.6 6 .4 2-1 3.8-1.7 6-.4 2.3 1.4 2.4 4.6 1.4 7.6-.9 2.7-1.5 6.4-3.2 6.4-1.6 0-1.7-4.2-4.2-4.2s-2.6 4.2-4.2 4.2c-1.7 0-2.3-3.7-3.2-6.4-1-3-.9-6.2 1.4-7.6Z";

/** App-icon mark: rounded tile with the tooth glyph. `inverse` is for blue backgrounds. */
export function LogoMark({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="9" fill={inverse ? "#ffffff" : "#1f5bff"} />
      <path d={TOOTH} fill={inverse ? "#1f5bff" : "#ffffff"} />
    </svg>
  );
}

export function Logo({ href = "/", className, inverse = false }: { href?: string; className?: string; inverse?: boolean }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 font-bold tracking-tight", inverse ? "text-white" : "text-brand-500", className)}
    >
      <LogoMark inverse={inverse} />
      <span className="text-lg">ParmarPro</span>
    </Link>
  );
}
