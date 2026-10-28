import { CheckIcon } from "lucide-react";

import { Halftone } from "@/components/brand/halftone";
import { Portal } from "@/components/brand/portal";
import { cn } from "@/lib/utils";

const POINTS = ["Every inquiry in one list", "Follow-ups that don't slip", "Each clinic's data kept separate"];

/** Blue halftone panel used beside sign-in, sign-up and onboarding forms. */
export function BrandPanel({ title, className }: { title: string; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-3xl bg-brand-500 text-white", className)}>
      <Halftone map="edge" inverse className="absolute inset-0" />
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
        <Portal className="hidden w-full max-w-sm self-end lg:block" />
      </div>
    </div>
  );
}
