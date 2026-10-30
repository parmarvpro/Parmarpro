"use client";

import { CopyIcon, KeyRoundIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { Field } from "@/components/forms/field";
import { useActionSubmit } from "@/components/forms/use-action-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { automationSettingsSchema } from "@/lib/validation/automations";
import { regenerateEnquiryFormKeyAction, setMyDigestOptOutAction, updateAutomationSettingsAction } from "@/server/actions/automations";

export type AutomationSettingsValues = {
  morning_digest: boolean;
  weekly_summary: boolean;
  untouched_lead_tasks: boolean;
  untouched_lead_hours: number;
  no_show_tasks: boolean;
  round_robin: boolean;
  recall_tasks: boolean;
  recall_months: number;
  patient_email_reminders: boolean;
  enquiry_form_enabled: boolean;
  ai_enquiry_help: boolean;
};

/** Editable copy of the settings. Numbers stay text while typing, so a cleared field is reported, not silently zero. */
type Draft = Omit<AutomationSettingsValues, "untouched_lead_hours" | "recall_months"> & {
  untouched_lead_hours: string;
  recall_months: string;
};

function draftFrom(settings: AutomationSettingsValues): Draft {
  return {
    morning_digest: settings.morning_digest,
    weekly_summary: settings.weekly_summary,
    untouched_lead_tasks: settings.untouched_lead_tasks,
    untouched_lead_hours: String(settings.untouched_lead_hours),
    no_show_tasks: settings.no_show_tasks,
    round_robin: settings.round_robin,
    recall_tasks: settings.recall_tasks,
    recall_months: String(settings.recall_months),
    patient_email_reminders: settings.patient_email_reminders,
    enquiry_form_enabled: settings.enquiry_form_enabled,
    ai_enquiry_help: settings.ai_enquiry_help,
  };
}

function candidateFrom(draft: Draft) {
  return {
    ...draft,
    untouched_lead_hours: Number(draft.untouched_lead_hours),
    recall_months: Number(draft.recall_months),
  };
}

/** One on/off setting. The label and help text are linked to the switch for assistive technology. */
function ToggleRow({
  id,
  label,
  help,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  help: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="text-sm font-medium text-ink-900">
          {label}
        </Label>
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {help}
        </p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} aria-describedby={`${id}-help`} />
    </div>
  );
}

export function AutomationSettingsForm({
  settings,
  enquiryLink,
  canUpdate,
  aiAvailable,
}: {
  settings: AutomationSettingsValues;
  enquiryLink: string | null;
  canUpdate: boolean;
  /** False while the paid AI key is not configured: the switch can be set, but nothing runs. */
  aiAvailable: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(settings));
  const { pending, run, fieldErrors, setFieldErrors } = useActionSubmit({ success: "Automation settings saved" });

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const locked = !canUpdate || pending;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Enter in a read-only field can submit the form; viewers have nothing to save.
    if (!canUpdate) return;
    const parsed = automationSettingsSchema.safeParse(candidateFrom(draft));
    if (!parsed.success) {
      setFieldErrors(z.flattenError(parsed.error).fieldErrors);
      return;
    }
    run(() => updateAutomationSettingsAction(parsed.data));
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-6">
      {!canUpdate ? (
        <p className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          Only owners and administrators can change these settings. You can see how they are set here.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Staff emails</CardTitle>
            <CardDescription>Sent to your team. Emails carry counts only, never patient names.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <ToggleRow
              id="morning_digest"
              label="Morning digest"
              help="Each morning, the number of tasks, follow-ups and appointments due today for each team member."
              checked={draft.morning_digest}
              disabled={locked}
              onCheckedChange={(checked) => set("morning_digest", checked)}
            />
            <ToggleRow
              id="weekly_summary"
              label="Weekly owner summary"
              help="Last week's inquiries, appointments and tasks, sent to the clinic owners."
              checked={draft.weekly_summary}
              disabled={locked}
              onCheckedChange={(checked) => set("weekly_summary", checked)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks created for you</CardTitle>
            <CardDescription>Automatic tasks appear in your Tasks list.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <div className="space-y-3 py-3 first:pt-0">
              <ToggleRow
                id="untouched_lead_tasks"
                label="Follow-up task for untouched inquiries"
                help="Create a task for a new inquiry that is still untouched after the number of hours below."
                checked={draft.untouched_lead_tasks}
                disabled={locked}
                onCheckedChange={(checked) => set("untouched_lead_tasks", checked)}
              />
              <Field
                label="Hours without action"
                htmlFor="untouched_lead_hours"
                error={fieldErrors.untouched_lead_hours}
                hint="Between 12 and 168 hours."
                className="max-w-56"
              >
                <Input
                  id="untouched_lead_hours"
                  name="untouched_lead_hours"
                  type="number"
                  inputMode="numeric"
                  min={12}
                  max={168}
                  step={1}
                  value={draft.untouched_lead_hours}
                  disabled={locked}
                  onChange={(event) => set("untouched_lead_hours", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.untouched_lead_hours)}
                />
              </Field>
            </div>
            <div className="py-3">
              <ToggleRow
                id="no_show_tasks"
                label="Call-back task after a missed appointment"
                help="When an appointment is marked as a no-show, create a call-back task for the next morning."
                checked={draft.no_show_tasks}
                disabled={locked}
                onCheckedChange={(checked) => set("no_show_tasks", checked)}
              />
            </div>
            <div className="space-y-3 py-3 last:pb-0">
              <ToggleRow
                id="recall_tasks"
                label="Recall patients"
                help="Create a recall task for patients who have not visited for the number of months below. Off by default."
                checked={draft.recall_tasks}
                disabled={locked}
                onCheckedChange={(checked) => set("recall_tasks", checked)}
              />
              <Field
                label="Months without a visit"
                htmlFor="recall_months"
                error={fieldErrors.recall_months}
                hint="Between 1 and 24 months."
                className="max-w-56"
              >
                <Input
                  id="recall_months"
                  name="recall_months"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={24}
                  step={1}
                  value={draft.recall_months}
                  disabled={locked}
                  onChange={(event) => set("recall_months", event.target.value)}
                  aria-invalid={Boolean(fieldErrors.recall_months)}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead assignment</CardTitle>
            <CardDescription>Decide who new inquiries are given to.</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleRow
              id="round_robin"
              label="Share new inquiries in turn"
              help="New inquiries without an assignee go, in turn, to the owners, admins and staff. Off by default."
              checked={draft.round_robin}
              disabled={locked}
              onCheckedChange={(checked) => set("round_robin", checked)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Patient emails</CardTitle>
            <CardDescription>Only patients who agreed to email contact receive these, and every email has a link to stop them.</CardDescription>
          </CardHeader>
          <CardContent>
            <ToggleRow
              id="patient_email_reminders"
              label="Appointment reminder email"
              help="Email each patient the day before their appointment. Off by default."
              checked={draft.patient_email_reminders}
              disabled={locked}
              onCheckedChange={(checked) => set("patient_email_reminders", checked)}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Website enquiry form</CardTitle>
            <CardDescription>A public form on your own website. Enquiries arrive as new inquiries, marked as coming from the website.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              id="enquiry_form_enabled"
              label="Accept enquiries through the form"
              help="The link below works only while this is on. Save to apply."
              checked={draft.enquiry_form_enabled}
              disabled={locked}
              onCheckedChange={(checked) => set("enquiry_form_enabled", checked)}
            />
            <EnquiryLink link={enquiryLink} enabled={draft.enquiry_form_enabled} canUpdate={canUpdate} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>AI help</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ToggleRow
              id="ai_enquiry_help"
              label="AI help with enquiries"
              help="Sends the text of each enquiry (never the name, phone number or email) to Google's Gemini service to suggest the treatment and how urgent it is. Google does not use it to improve its products. Staff check every suggestion; nothing is sent to patients automatically."
              checked={draft.ai_enquiry_help}
              disabled={locked}
              onCheckedChange={(checked) => set("ai_enquiry_help", checked)}
            />
            {aiAvailable ? null : (
              <p className="text-sm text-muted-foreground">Not available yet: the AI service has not been switched on for ParmarPro.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {canUpdate ? (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function EnquiryLink({ link, enabled, canUpdate }: { link: string | null; enabled: boolean; canUpdate: boolean }) {
  if (link === null) {
    if (enabled && canUpdate) return <CreateLinkPrompt />;
    return (
      <p className="text-sm text-muted-foreground">
        {canUpdate ? "Turn the form on and save to create its link." : "No link has been created yet. An owner or administrator can create one."}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {enabled ? null : <p className="text-sm text-muted-foreground">The form is off, so this link does not accept enquiries until you turn it on and save.</p>}
      <Label htmlFor="enquiry-link" className="text-sm font-medium text-ink-900">
        Your enquiry link
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="enquiry-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="font-mono text-xs" />
        <CopyLinkButton link={link} />
      </div>
      {canUpdate ? (
        <div>
          <ConfirmActionButton
            label="Create a new link"
            icon={<KeyRoundIcon />}
            title="Create a new enquiry link?"
            description="The current link stops working straight away. Replace it everywhere you have shared it, such as your website."
            confirmLabel="Create new link"
            success="New enquiry link created"
            action={regenerateEnquiryFormKeyAction}
          />
        </div>
      ) : null}
    </div>
  );
}

function CopyLinkButton({ link }: { link: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link. Select it and copy it by hand.");
    }
  }
  return (
    <Button type="button" variant="outline" onClick={copy} className="shrink-0">
      <CopyIcon />
      Copy link
    </Button>
  );
}

function CreateLinkPrompt() {
  const { pending, run } = useActionSubmit({ success: "Enquiry link created" });
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-brand-200 bg-brand-50/50 px-4 py-4">
      <p className="text-sm text-ink-700">Create the link to start accepting enquiries from your website.</p>
      <Button type="button" onClick={() => run(() => regenerateEnquiryFormKeyAction())} disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
        Create link
      </Button>
    </div>
  );
}

/** The caller's own staff digest preference. Any member can change it, including viewers. */
export function MyEmailsCard({ digestOptOut }: { digestOptOut: boolean }) {
  const { pending, run } = useActionSubmit({ success: "Your email preference is saved" });
  return (
    <Card>
      <CardHeader>
        <CardTitle>My emails</CardTitle>
        <CardDescription>Only you see this setting.</CardDescription>
      </CardHeader>
      <CardContent>
        <ToggleRow
          id="my_morning_summary"
          label="Send me the morning summary"
          help="The staff morning digest, with counts only. Turn it off to stop receiving it."
          checked={!digestOptOut}
          disabled={pending}
          onCheckedChange={(checked) => run(() => setMyDigestOptOutAction(!checked))}
        />
      </CardContent>
    </Card>
  );
}
