"use client";

import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { startTransition, useActionState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { EnquiryFormState } from "@/lib/validation/enquiry";

type EnquiryAction = (state: EnquiryFormState, formData: FormData) => Promise<EnquiryFormState>;

const FAILURE_MESSAGES: Record<string, (clinicName: string) => string> = {
  unavailable: (clinicName) => `This enquiry form is not available right now. Please contact ${clinicName} directly.`,
  busy: (clinicName) => `${clinicName} has received many enquiries today. Please try again tomorrow, or contact the clinic directly.`,
  rate_limited: () => "Too many attempts. Please wait a few minutes and try again.",
  error: () => "We could not send your enquiry. Please try again.",
};

/**
 * Public enquiry form. Errors come from the server action and are shown per
 * field. The submit goes through a transition rather than a form action, so the
 * browser keeps what the visitor typed when a field needs correcting.
 */
export function EnquiryForm({ clinicName, action }: { clinicName: string; action: EnquiryAction }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });

  if (state.status === "sent") {
    return (
      <Alert variant="success">
        <CheckCircle2Icon />
        <div>
          <AlertTitle>Thank you.</AlertTitle>
          <AlertDescription>{clinicName} will contact you soon.</AlertDescription>
        </div>
      </Alert>
    );
  }

  const errors: Record<string, string[] | undefined> = state.status === "invalid" ? state.fieldErrors : {};
  const failure = FAILURE_MESSAGES[state.status];

  const fieldError = (name: string) =>
    errors[name]?.[0] ? (
      <p id={`enquiry-${name}-error`} className="text-xs text-destructive">
        {errors[name]?.[0]}
      </p>
    ) : null;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {failure ? (
        <Alert variant="destructive">
          <AlertDescription className="mt-0">{failure(clinicName)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="enquiry-name">Your name</Label>
        <Input
          id="enquiry-name"
          name="fullName"
          autoComplete="name"
          required
          maxLength={120}
          aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? "enquiry-fullName-error" : undefined}
        />
        {fieldError("fullName")}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enquiry-phone">Phone</Label>
        <Input
          id="enquiry-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "enquiry-phone-error enquiry-phone-hint" : "enquiry-phone-hint"}
        />
        <p id="enquiry-phone-hint" className="text-xs text-muted-foreground">
          For example 98xxxxxxxx. Give a phone number or an email, or both.
        </p>
        {fieldError("phone")}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enquiry-email">Email</Label>
        <Input
          id="enquiry-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "enquiry-email-error" : undefined}
        />
        {fieldError("email")}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enquiry-message">How can we help? (optional)</Label>
        <Textarea
          id="enquiry-message"
          name="message"
          rows={4}
          maxLength={1500}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? "enquiry-message-error" : undefined}
        />
        {fieldError("message")}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-start gap-3">
          <input
            id="enquiry-consent"
            name="consent"
            type="checkbox"
            value="on"
            required
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? "enquiry-consent-error" : undefined}
            className="mt-0.5 size-4 shrink-0 rounded-[5px] border-input accent-brand-600"
          />
          <Label htmlFor="enquiry-consent" className="leading-relaxed font-normal">
            I agree that {clinicName} may contact me about this enquiry.
          </Label>
        </div>
        {fieldError("consent")}
      </div>

      {/* Honeypot: hidden from people and assistive technology. Bots that fill every field reveal themselves. */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="enquiry-website">Website</label>
        <input id="enquiry-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : null}
        Send enquiry
      </Button>
    </form>
  );
}
