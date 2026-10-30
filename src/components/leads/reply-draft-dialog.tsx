"use client";

import { CopyIcon, Loader2Icon, MessageCircleIcon, PencilLineIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { whatsappLink } from "@/lib/whatsapp";
import { draftLeadReplyAction } from "@/server/actions/leads";

const NOTE = {
  ai: "Suggested by AI, check before sending.",
  no_enquiry: "This lead has no enquiry text to answer, so this is the standard message.",
  ai_unavailable: "AI is not available right now, so this is the standard message.",
} as const;

/**
 * Asks for a suggested reply to a lead's enquiry and shows it in a dialog, to edit. Nothing is stored
 * or sent: staff copy the text or open it in WhatsApp, check it and send it themselves. A refusal
 * shows as a toast with the server's message. Nothing is stored, so the page is not refreshed.
 */
export function DraftReplyButton({ leadId, phone }: { leadId: string; phone: string | null }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<keyof typeof NOTE>("ai_unavailable");
  const [text, setText] = useState("");

  function draft() {
    startTransition(async () => {
      try {
        const result = await draftLeadReplyAction(leadId);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        setNote(result.data.source === "ai" ? "ai" : result.data.reason);
        setText(result.data.text);
        setOpen(true);
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
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
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={draft}>
        {pending ? <Loader2Icon className="animate-spin" /> : <PencilLineIcon />}
        Draft a reply
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Draft a reply</DialogTitle>
            <DialogDescription>{NOTE[note]}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reply-draft-text">Reply</Label>
            <Textarea id="reply-draft-text" rows={8} value={text} onChange={(event) => setText(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button type="button" variant="outline" disabled={reply === ""} onClick={copy}>
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
