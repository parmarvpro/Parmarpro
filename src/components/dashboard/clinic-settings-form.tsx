"use client";

import { Loader2Icon } from "lucide-react";

import { Field } from "@/components/forms/field";
import { formValues, useActionSubmit } from "@/components/forms/use-action-submit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clinicSettingsSchema } from "@/lib/validation/clinic";
import { updateClinicAction } from "@/server/actions/team";

export function ClinicSettingsForm({ name, city, disabled }: { name: string; city: string; disabled: boolean }) {
  const { pending, run, fieldErrors, setFieldErrors } = useActionSubmit({ success: "Clinic details saved" });
  return (
    <form
      noValidate
      className="max-w-md space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const values = formValues(event.currentTarget);
        const parsed = clinicSettingsSchema.safeParse(values);
        if (!parsed.success) {
          setFieldErrors(parsed.error.flatten().fieldErrors);
          return;
        }
        run(() => updateClinicAction(values));
      }}
    >
      <Field label="Clinic name" htmlFor="name" error={fieldErrors.name}>
        <Input id="name" name="name" defaultValue={name} required maxLength={120} disabled={disabled} />
      </Field>
      <Field label="City" htmlFor="city" error={fieldErrors.city}>
        <Input id="city" name="city" defaultValue={city} required maxLength={80} disabled={disabled} />
      </Field>
      {!disabled ? (
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Save changes
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Only owners and administrators can change clinic details.</p>
      )}
    </form>
  );
}
