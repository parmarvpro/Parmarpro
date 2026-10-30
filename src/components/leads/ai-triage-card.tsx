import { DraftReplyButton } from "@/components/leads/reply-draft-dialog";
import { SortWithAiButton } from "@/components/leads/sort-with-ai-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LANGUAGE_LABELS, TREATMENT_LABELS, URGENCY_LABELS, type Urgency } from "@/lib/ai-triage";
import { formatDateTime } from "@/lib/format";

/** A stored triage as the lead page reads it. The values are text in the database, so they are checked against the labels here. */
export type LeadTriageView = {
  treatment: string;
  urgency: string;
  language: string;
  best_time: string | null;
  summary: string;
  model: string;
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
 * The AI sorting card on a lead. Shown only while the clinic has AI help on (the caller decides).
 * Every suggestion is labelled as such. The sort and reply-draft buttons appear only for members who
 * may update the lead while the paid key is configured. `phone` is the lead's number, for WhatsApp.
 */
export function AiTriageCard({
  leadId,
  phone,
  triage,
  canSort,
}: {
  leadId: string;
  phone: string | null;
  triage: LeadTriageView | null;
  canSort: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>AI sorting</CardTitle>
        {canSort ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DraftReplyButton leadId={leadId} phone={phone} />
            <SortWithAiButton leadId={leadId} label={triage ? "Sort again" : "Sort with AI"} />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {triage ? <TriageDetails triage={triage} /> : <p className="text-sm text-muted-foreground">Not sorted yet.</p>}
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
      <p className="text-xs text-muted-foreground">
        Suggested by AI, check before acting · {triage.model} · {formatDateTime(triage.updated_at)}
      </p>
    </>
  );
}
