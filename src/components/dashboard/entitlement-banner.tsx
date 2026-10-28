import { AlertTriangleIcon, ClockIcon } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export function EntitlementBanner({
  entitled,
  accessEndsAt,
  accessEndsSoon,
  onTrial,
  canManageBilling,
}: {
  entitled: boolean;
  accessEndsAt: string | null;
  accessEndsSoon: boolean;
  onTrial: boolean;
  canManageBilling: boolean;
}) {
  if (!entitled) {
    return (
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <AlertTriangleIcon />
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <AlertTitle>Your clinic&apos;s plan is not active</AlertTitle>
            <AlertDescription className="mt-0.5">
              Records stay readable. {canManageBilling ? "Renew to add or change records." : "Ask the clinic owner to renew."}
            </AlertDescription>
          </div>
          {canManageBilling ? (
            <Button asChild size="sm">
              <Link href="/dashboard/settings/billing">Renew now</Link>
            </Button>
          ) : null}
        </div>
      </Alert>
    );
  }

  if (accessEndsSoon && accessEndsAt) {
    return (
      <Alert variant="info" className="rounded-none border-x-0 border-t-0">
        <ClockIcon />
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <AlertDescription className="mt-0 font-medium text-brand-800">
            {onTrial ? "Your free trial" : "Your paid period"} ends on {formatDate(accessEndsAt)}.
          </AlertDescription>
          {canManageBilling ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/settings/billing">{onTrial ? "Choose plan" : "Pay for next month"}</Link>
            </Button>
          ) : null}
        </div>
      </Alert>
    );
  }
  return null;
}
