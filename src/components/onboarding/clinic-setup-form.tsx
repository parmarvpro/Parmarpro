"use client";

import { useOrganizationList } from "@clerk/nextjs";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics/client";
import { clinicSetupSchema } from "@/lib/validation/clinic";
import { completeClinicSetup } from "@/server/actions/onboarding";

/**
 * Creates the Clerk organization in the browser (so it becomes the active
 * organization on this session), then asks the server to create the clinic
 * for it. When `existingOrgName` is set, the organization already exists and
 * is active; only the server step runs.
 */
export function ClinicSetupForm({ existingOrgName }: { existingOrgName?: string }) {
  const router = useRouter();
  const { isLoaded, createOrganization, setActive } = useOrganizationList();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const parsed = clinicSetupSchema.safeParse(raw);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    setError(null);
    setPending(true);
    try {
      if (!existingOrgName) {
        if (!isLoaded || !createOrganization || !setActive) throw new Error("not_ready");
        const organization = await createOrganization({ name: parsed.data.name });
        await setActive({ organization: organization.id });
      }
      const result = await completeClinicSetup(parsed.data);
      if (!result.ok) {
        setError(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      track("clinic_created", {});
      track("onboarding_completed", {});
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("We could not create your clinic. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="mt-0">{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="name">Clinic name</Label>
        <Input id="name" name="name" defaultValue={existingOrgName} required aria-invalid={Boolean(fieldErrors.name)} />
        {fieldErrors.name?.[0] ? <p className="text-xs text-destructive">{fieldErrors.name[0]}</p> : null}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="city">City</Label>
        <Input id="city" name="city" defaultValue="Mumbai" required aria-invalid={Boolean(fieldErrors.city)} />
        {fieldErrors.city?.[0] ? <p className="text-xs text-destructive">{fieldErrors.city[0]}</p> : null}
      </div>
      <Button type="submit" className="w-full" disabled={pending || (!existingOrgName && !isLoaded)}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        {existingOrgName ? "Finish clinic setup" : "Create clinic workspace"}
      </Button>
    </form>
  );
}
