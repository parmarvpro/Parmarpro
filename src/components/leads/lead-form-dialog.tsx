"use client";

import { Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { leadSourceOptions, leadStatusOptions, memberLabel, type MemberOption } from "@/components/dashboard/options";
import { Field } from "@/components/forms/field";
import { formValues, useActionSubmit } from "@/components/forms/use-action-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics/client";
import { isoToIstLocal } from "@/lib/validation/common";
import { leadInputSchema } from "@/lib/validation/entities";
import { createLeadAction, updateLeadAction } from "@/server/actions/leads";

export type LeadFormValues = {
  id: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  source: string;
  status: string;
  assigned_to: string | null;
  next_follow_up_at: string | null;
  notes: string | null;
  lost_reason: string | null;
};

export function LeadFormDialog({ members, lead }: { members: MemberOption[]; lead?: LeadFormValues }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(lead?.status ?? "new");
  const { pending, run, fieldErrors, setFieldErrors } = useActionSubmit<unknown>({
    success: lead ? "Lead updated" : "Lead added",
    onSuccess: (data) => {
      if (!lead && data && typeof data === "object" && "source" in data) {
        track("lead_created", { source: (data as { source: (typeof leadSourceOptions)[number]["value"] }).source });
      }
      setOpen(false);
    },
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event.currentTarget);
    const parsed = leadInputSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    run(() => (lead ? updateLeadAction(lead.id, values) : createLeadAction(values)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {lead ? (
          <Button variant="outline" size="sm">
            <PencilIcon /> Edit
          </Button>
        ) : (
          <Button>
            <PlusIcon /> Add lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit lead" : "Add lead"}</DialogTitle>
          <DialogDescription>Record who got in touch and when to follow up. Don&apos;t add clinical details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Field label="Full name" htmlFor="fullName" error={fieldErrors.fullName} className="sm:col-span-2">
            <Input id="fullName" name="fullName" defaultValue={lead?.full_name} required maxLength={120} aria-invalid={Boolean(fieldErrors.fullName)} />
          </Field>
          <Field label="Phone" htmlFor="phone" error={fieldErrors.phone} hint="10-digit mobile or +country code">
            <Input id="phone" name="phone" type="tel" defaultValue={lead?.phone_e164 ?? ""} aria-invalid={Boolean(fieldErrors.phone)} />
          </Field>
          <Field label="Email" htmlFor="email" error={fieldErrors.email}>
            <Input id="email" name="email" type="email" defaultValue={lead?.email ?? ""} aria-invalid={Boolean(fieldErrors.email)} />
          </Field>
          <Field label="Source" htmlFor="source" error={fieldErrors.source}>
            <NativeSelect id="source" name="source" defaultValue={lead?.source ?? "phone_call"}>
              {leadSourceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Status" htmlFor="status" error={fieldErrors.status}>
            <NativeSelect id="status" name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
              {leadStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Assigned to" htmlFor="assignedTo" error={fieldErrors.assignedTo}>
            <NativeSelect id="assignedTo" name="assignedTo" defaultValue={lead?.assigned_to ?? ""}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberLabel(member)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Next follow-up" htmlFor="nextFollowUpAt" error={fieldErrors.nextFollowUpAt} hint="India Standard Time">
            <Input id="nextFollowUpAt" name="nextFollowUpAt" type="datetime-local" defaultValue={isoToIstLocal(lead?.next_follow_up_at)} />
          </Field>
          {status === "lost" ? (
            <Field label="Reason lost" htmlFor="lostReason" error={fieldErrors.lostReason} className="sm:col-span-2">
              <Input id="lostReason" name="lostReason" defaultValue={lead?.lost_reason ?? ""} maxLength={300} />
            </Field>
          ) : null}
          <Field label="Notes" htmlFor="notes" error={fieldErrors.notes} hint="Operational notes only. Do not record diagnoses or treatment details." className="sm:col-span-2">
            <Textarea id="notes" name="notes" defaultValue={lead?.notes ?? ""} maxLength={2000} rows={3} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {lead ? "Save changes" : "Add lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
