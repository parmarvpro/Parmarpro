import { SearchXIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-200">
        <SearchXIcon className="size-5" />
      </span>
      <h1 className="mt-5 text-xl font-bold text-ink-900">Record not found</h1>
      <p className="mt-2 text-sm text-ink-500">It may have been deleted, or it belongs to a different clinic.</p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Back to overview</Link>
      </Button>
    </div>
  );
}
