import type { LucideIcon } from "lucide-react";

import { Sparkle } from "@/components/brand/sparkle";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-white px-6 py-14 text-center">
      <span className="relative flex size-12 items-center justify-center">
        <Sparkle className="absolute -top-8 -left-8 size-28 opacity-40" />
        <span className="relative flex size-12 items-center justify-center rounded-2xl bg-brand-500 text-white">
          <Icon className="size-5" />
        </span>
      </span>
      <h3 className="mt-5 font-semibold text-ink-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
