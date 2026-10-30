"use client";

import { Loader2Icon } from "lucide-react";

import { useActionSubmit } from "@/components/forms/use-action-submit";
import { Button } from "@/components/ui/button";
import { sortLeadWithAiAction } from "@/server/actions/leads";

/** Asks for an AI sort of one lead. A refusal or a busy model shows as a toast with the server's message. */
export function SortWithAiButton({ leadId, label }: { leadId: string; label: string }) {
  const { pending, run } = useActionSubmit({ success: "Lead sorted. Check the suggestion before acting." });
  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(() => sortLeadWithAiAction(leadId))}>
      {pending ? <Loader2Icon className="animate-spin" /> : null}
      {label}
    </Button>
  );
}
