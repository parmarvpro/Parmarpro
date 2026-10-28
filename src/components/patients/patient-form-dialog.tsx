"use client";

import { Loader2Icon, PencilIcon, UserPlusIcon } from "lucide-react";
import { useState } from "react";

import { Field } from "@/components/forms/field";
import { formValues, useActionSubmit } from "@/components/forms/use-action-submit";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics/client";
import { patientInputSchema } from "@/lib/validation/entities";
import { createPatientAction, updatePatientAction } from "@/server/actions/patients";

export type PatientFormValues = {
  id: string;
  full_name: string;
  phone_e164: string | null;
  email: string | null;
  whatsapp_consent: boolean;
  sms_consent: boolean;
  email_consent: boolean;
  opted_out_at: string | null;
};

const CONSENTS = [
  { name: "whatsappConsent", key: "whatsapp_consent", label: "WhatsApp messages" },
  { name: "smsConsent", key: "sms_consent", label: "SMS" },
  { name: "emailConsent", key: "email_consent", label: "Email" },
] as const;

export function PatientFormDialog({ patient }: { patient?: PatientFormValues }) {
  const [open, setOpen] = useState(false);
  const { pending, run, fieldErrors, setFieldErrors } = useActionSubmit({
    success: patient ? "Patient updated" : "Patient added",
    onSuccess: () => {
      if (!patient) track("patient_created", {});
      setOpen(false);
    },
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event.currentTarget);
    const parsed = patientInputSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    run(() => (patient ? updatePatientAction(patient.id, values) : createPatientAction(values)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {patient ? (
          <Button variant="outline" size="sm">
            <PencilIcon /> Edit
          </Button>
        ) : (
          <Button>
            <UserPlusIcon /> Add patient
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{patient ? "Edit patient" : "Add patient"}</DialogTitle>
          <DialogDescription>Contact details and communication preferences only. ParmarPro is not a clinical record.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Full name" htmlFor="fullName" error={fieldErrors.fullName}>
            <Input id="fullName" name="fullName" required maxLength={120} defaultValue={patient?.full_name} aria-invalid={Boolean(fieldErrors.fullName)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone" error={fieldErrors.phone}>
              <Input id="phone" name="phone" type="tel" defaultValue={patient?.phone_e164 ?? ""} aria-invalid={Boolean(fieldErrors.phone)} />
            </Field>
            <Field label="Email" htmlFor="email" error={fieldErrors.email}>
              <Input id="email" name="email" type="email" defaultValue={patient?.email ?? ""} aria-invalid={Boolean(fieldErrors.email)} />
            </Field>
          </div>
          <fieldset className="space-y-3 rounded-lg border p-4">
            <legend className="px-1 text-sm font-medium">Communication consent</legend>
            <p className="text-xs text-muted-foreground">Record only what the patient has agreed to. The date is stored when consent changes.</p>
            {CONSENTS.map((consent) => (
              <div key={consent.name} className="flex items-center gap-2">
                <Checkbox id={consent.name} name={consent.name} defaultChecked={patient?.[consent.key] ?? false} />
                <Label htmlFor={consent.name} className="font-normal">
                  {consent.label}
                </Label>
              </div>
            ))}
            <div className="flex items-center gap-2 border-t pt-3">
              <Checkbox id="optedOut" name="optedOut" defaultChecked={Boolean(patient?.opted_out_at)} />
              <Label htmlFor="optedOut" className="font-normal">
                Patient has opted out of all non-essential messages
              </Label>
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {patient ? "Save" : "Add patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
