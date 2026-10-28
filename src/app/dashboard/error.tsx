"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertTriangleIcon } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <AlertTriangleIcon className="size-10 text-destructive" />
      <h1 className="mt-4 text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We couldn&apos;t load this page. You may not have access to it, or the service is briefly unavailable.
        {error.digest ? ` Reference: ${error.digest}` : null}
      </p>
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Go to overview</Link>
        </Button>
      </div>
    </div>
  );
}
