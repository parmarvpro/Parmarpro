import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <h1 className="text-xl font-semibold">Record not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">It may have been deleted, or it belongs to a different clinic.</p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Back to overview</Link>
      </Button>
    </div>
  );
}
