import { LockIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function NoAccess({ what }: { what: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <LockIcon className="size-5" />
      </span>
      <h1 className="mt-4 text-xl font-semibold">You don&apos;t have permission to view {what}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Ask your clinic owner or administrator if you need access.</p>
      <Button asChild className="mt-6" variant="outline">
        <Link href="/dashboard">Back to overview</Link>
      </Button>
    </div>
  );
}
