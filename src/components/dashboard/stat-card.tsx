import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";

export function Stat({ label, value, hint, icon: Icon, href }: { label: string; value: number; hint: string; icon: LucideIcon; href?: string }) {
  const body = (
    <Card className="h-full overflow-hidden transition-colors hover:border-brand-300">
      <div aria-hidden="true" className="h-1.5 bg-linear-to-r from-brand-500 to-brand-200" />
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="eyebrow">{label}</p>
          <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-ink-900">{value}</p>
          <p className="mt-1 text-xs text-ink-500">{hint}</p>
        </div>
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-white">
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="rounded-2xl focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
