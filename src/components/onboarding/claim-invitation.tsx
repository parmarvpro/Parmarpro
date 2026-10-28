"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { claimInvitation } from "@/server/actions/onboarding";

export function ClaimInvitation() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setMessage(null);
    const result = await claimInvitation();
    setPending(false);
    if (result.ok && result.data.joined) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }
    setMessage(
      result.ok
        ? "We could not find a pending invitation for your verified email in this clinic. Ask the clinic owner or administrator to invite you."
        : result.message,
    );
  }

  return (
    <div className="space-y-4">
      {message ? (
        <Alert variant="warning">
          <AlertDescription className="mt-0">{message}</AlertDescription>
        </Alert>
      ) : null}
      <Button onClick={onClick} disabled={pending} className="w-full">
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Join this clinic
      </Button>
    </div>
  );
}
