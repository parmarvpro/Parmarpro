"use client";

import { CopyIcon, Loader2Icon, MessageCircleIcon, PencilLineIcon, RefreshCwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { whatsappLink } from "@/lib/whatsapp";
import { draftLeadReplyAction } from "@/server/actions/leads";

/** Where the text in the box came from. "template" is the standard follow-up message, with the reason. */
type DraftSource = { source: "ai" } | { source: "template"; reason: "no_enquiry" | "ai_unavailable" };

function describe(draft: DraftSource | null, pending: boolean): string {
  if (pending || draft === null) return "Gemini is drafting a reply from the enquiry text.";
  if (draft.source === "ai") return "Suggested by Gemini. Check it, edit it if you need to, then send it yourself. Nothing has been sent.";
  return draft.reason === "no_enquiry"
    ? "This lead has no enquiry text, so this is the standard follow-up message."
    : "Gemini did not give a usable reply, so this is the standard follow-up message.";
}

/**
 * Asks Gemini for a suggested reply to a lead's enquiry and shows it in a dialog, to edit. The dialog
 * opens at once and says that a draft is on its way. Nothing is stored or sent: staff copy the text or
 * open it in WhatsApp, check it and send it themselves. If a draft fails when the box already holds
 * text, the text is kept; if there is none yet, the dialog closes and a toast says why.
 */
export function DraftReplyButton({ leadId, phone }: { leadId: string; phone: string | null }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftSource | null>(null);
  const [text, setText] = useState("");

  function draftReply() {
    const hadText = text !== "";
    startTransition(async () => {
      try {
        const result = await draftLeadReplyAction(leadId);
        if (!result.ok) {
          if (!hadText) setOpen(false);
          toast.error(result.message);
          return;
        }
        setDraft(result.data.source === "ai" ? { source: "ai" } : { source: "template", reason: result.data.reason });
        setText(result.data.text);
      } catch {
        if (!hadText) setOpen(false);
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  function openAndDraft() {
    setOpen(true);
    draftReply();
  }

  const reply = text.trim();
  // The link carries the text as it is in the box now, so an edit is what the chat opens with.
  const link = phone && reply !== "" ? whatsappLink(phone, reply) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(reply);
      toast.success("Reply copied");
    } catch {
      toast.error("Could not copy the reply. Select the text and copy it by hand.");
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={openAndDraft}>
        <PencilLineIcon />
        Draft a reply
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Draft a reply</DialogTitle>
            <DialogDescription>{describe(draft, pending)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reply-draft-text">Reply</Label>
            <Textarea
              id="reply-draft-text"
              rows={8}
              value={text}
              disabled={pending}
              placeholder={pending ? "Drafting…" : undefined}
              onChange={(event) => setText(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">Drafting again replaces the text in the box.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" variant="outline" disabled={pending} onClick={draftReply}>
              {pending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
              Draft again
            </Button>
            <Button type="button" variant="outline" disabled={reply === "" || pending} onClick={copy}>
              <CopyIcon />
              Copy
            </Button>
            {link ? (
              <Button asChild>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon />
                  Open in WhatsApp
                </a>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
