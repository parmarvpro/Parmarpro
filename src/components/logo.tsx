import Link from "next/link";

import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M10 9.5c2.2-1.3 4-.6 6 .4 2-1 3.8-1.7 6-.4 2.3 1.4 2.4 4.6 1.4 7.6-.9 2.7-1.5 6.4-3.2 6.4-1.6 0-1.7-4.2-4.2-4.2s-2.6 4.2-4.2 4.2c-1.7 0-2.3-3.7-3.2-6.4-1-3-.9-6.2 1.4-7.6Z"
        className="fill-primary-foreground"
      />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      <span className="text-lg">ParmarPro</span>
    </Link>
  );
}
