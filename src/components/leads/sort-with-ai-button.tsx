"use client";

import { Loader2Icon } from "lucide-react";

import { useActionSubmit } from "@/components/forms/use-action-submit";
import { Button } from "@/components/ui/button";
import { sortLeadWithAiAction } from "@/server/actions/leads";

/**
 * Asks Gemini to sort one lead. It is disabled while the lead has no enquiry text to sort, and while a
 * sort is running. A refusal or a busy model shows as a toast with the server's message.
 */
export function SortWithAiButton({ leadId, label, disabled = false }: { leadId: string; label: string; disabled?: boolean }) {
  const { pending, run } = useActionSubmit({ success: "Lead sorted. Check the suggestion before acting." });
  return (
    <Button type="button" variant="outline" size="sm" disabled={pending || disabled} onClick={() => run(() => sortLeadWithAiAction(leadId))}>
      {pending ? <Loader2Icon className="animate-spin" /> : null}
      {pending ? "Sorting…" : label}
    </Button>
  );
}
