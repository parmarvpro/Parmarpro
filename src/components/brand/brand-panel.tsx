import { CheckIcon } from "lucide-react";

import { DotDrift } from "@/components/motion/dot-drift";
import { Portal } from "@/components/brand/portal";
import { cn } from "@/lib/utils";

const POINTS = ["Every inquiry in one list", "Follow-ups that don't slip", "Each clinic's data kept separate"];

/** Blue halftone panel used beside sign-in, sign-up and onboarding forms. */
export function BrandPanel({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-3xl bg-brand-500 text-white", className)}>
      <DotDrift index={0} className="opacity-70" style={{ "--dot-mask": "linear-gradient(to bottom, transparent 20%, #000 85%)" } as React.CSSProperties} />
      <div className="relative flex h-full flex-col justify-between gap-8 p-8 lg:p-10">
        <div className="space-y-5">
          <p className="headline text-3xl lg:text-5xl">{title}</p>
          <ul className="space-y-2 text-sm">
            {POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2.5">
                <span className="flex size-5 items-center justify-center rounded-full bg-white text-brand-600">
                  <CheckIcon className="size-3.5" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <Portal className="bob hidden w-full max-w-sm self-end lg:block" />
      </div>
    </div>
  );
}
