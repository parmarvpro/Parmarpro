import { DraftReplyButton } from "@/components/leads/reply-draft-dialog";
import { SortWithAiButton } from "@/components/leads/sort-with-ai-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LANGUAGE_LABELS, TREATMENT_LABELS, URGENCY_LABELS, type Urgency } from "@/lib/ai-triage";
import { formatDateTime } from "@/lib/format";

/** A stored triage as the lead page reads it. The values are text in the database, so they are checked against the labels here. */
export type LeadTriageView = {
  treatment: string;
  urgency: string;
  language: string;
  best_time: string | null;
  summary: string;
  updated_at: string;
};

const URGENCY_VARIANT: Record<Urgency, "destructive" | "warning" | "secondary"> = {
  call_today: "destructive",
  soon: "warning",
  routine: "secondary",
};

/** The label for a stored value. A value the labels do not know is shown as stored. */
function labelFor(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value;
}

/**
 * The AI help card on a lead. Shown only while the clinic has AI help on (the caller decides).
 * Every result is a suggestion and is labelled as one. Staff who can edit the lead get the two
 * prompts while the Gemini service is connected; everyone else sees the last suggestion. When the
 * service is not connected, the card says so rather than showing buttons that cannot work.
 * `phone` is the lead's number, for WhatsApp. `hasEnquiry` is false when there is no enquiry text to sort.
 */
export function AiTriageCard({
  leadId,
  phone,
  triage,
  canUpdate,
  aiAvailable,
  hasEnquiry,
}: {
  leadId: string;
  phone: string | null;
  triage: LeadTriageView | null;
  canUpdate: boolean;
  aiAvailable: boolean;
  hasEnquiry: boolean;
}) {
  const canRun = canUpdate && aiAvailable;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>AI help</CardTitle>
          {canRun ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <DraftReplyButton leadId={leadId} phone={phone} />
              <SortWithAiButton leadId={leadId} label={triage ? "Sort again" : "Sort with AI"} disabled={!hasEnquiry} />
            </div>
          ) : null}
        </div>
        <CardDescription>Gemini suggests. Check before acting.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {aiAvailable ? null : (
          <p className="text-sm text-muted-foreground">Gemini is not connected for ParmarPro yet, so nothing is sent. Reply to this enquiry by hand for now.</p>
        )}
        {canRun && !hasEnquiry ? <p className="text-sm text-muted-foreground">This lead has no enquiry text to sort.</p> : null}
        {triage ? (
          <TriageDetails triage={triage} />
        ) : aiAvailable ? (
          <p className="text-sm text-muted-foreground">Not sorted yet.</p>
        ) : null}
        {canRun ? (
          <p className="text-xs text-muted-foreground">
            Sorting and drafting send the enquiry text to Gemini, without the name, phone number or email. See AI help in Settings for the full list.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TriageDetails({ triage }: { triage: LeadTriageView }) {
  const urgency = triage.urgency as Urgency;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={URGENCY_VARIANT[urgency] ?? "outline"}>{labelFor(URGENCY_LABELS, triage.urgency)}</Badge>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Treatment</dt>
        <dd>{labelFor(TREATMENT_LABELS, triage.treatment)}</dd>
        <dt className="text-muted-foreground">Language</dt>
        <dd>{labelFor(LANGUAGE_LABELS, triage.language)}</dd>
        {triage.best_time ? (
          <>
            <dt className="text-muted-foreground">Best time</dt>
            <dd>{triage.best_time}</dd>
          </>
        ) : null}
      </dl>
      <p className="text-sm">{triage.summary}</p>
      <p className="text-xs text-muted-foreground">Suggested by Gemini · {formatDateTime(triage.updated_at)}</p>
    </>
  );
}
