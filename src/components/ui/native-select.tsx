import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Styled native <select>. Native selects work with plain form submission,
 * keyboard navigation and screen readers without extra state.
 */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "flex h-10 w-full appearance-none rounded-lg border border-input bg-white py-1 pr-8 pl-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-brand-500 focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
