import { ArrowLeftIcon, ArrowRightIcon, RotateCwIcon } from "lucide-react";

import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

/** Browser chrome around an illustration. Decorative frame; the content inside carries its own labelling. */
export function BrowserFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-hairline bg-white shadow-[0_24px_60px_-28px_rgb(13_71_230/0.35)]", className)}>
      <div aria-hidden="true" className="border-b border-hairline bg-ink-50">
        <div className="flex items-end gap-4 px-4 pt-3">
          <div className="flex gap-1.5 pb-3">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex items-center gap-2 rounded-t-xl border border-b-0 border-hairline bg-white px-3 py-2 text-xs font-medium text-ink-700">
            <LogoMark className="size-4" />
            Home – ParmarPro
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-hairline bg-white px-4 py-2 text-ink-500">
          <ArrowLeftIcon className="size-3.5" />
          <ArrowRightIcon className="size-3.5 opacity-50" />
          <RotateCwIcon className="size-3.5" />
          <span className="flex-1 rounded-full bg-ink-50 px-3 py-1 text-xs text-ink-600">parmarpro.in</span>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
