import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const PAGE_SIZE = 25;

export function Pagination({ page, total, searchParams, basePath }: { page: number; total: number; searchParams: Record<string, string | undefined>; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return <p className="mt-4 text-xs text-muted-foreground">{total} {total === 1 ? "record" : "records"}</p>;
  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) if (value && key !== "page") params.set(key, value);
    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  };
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <p className="text-muted-foreground">
        Page {page} of {pages} · {total} records
      </p>
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : undefined}>
          <Link href={href(Math.max(1, page - 1))}>
            <ChevronLeftIcon /> Previous
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" aria-disabled={page >= pages} className={page >= pages ? "pointer-events-none opacity-50" : undefined}>
          <Link href={href(Math.min(pages, page + 1))}>
            Next <ChevronRightIcon />
          </Link>
        </Button>
      </div>
    </div>
  );
}
