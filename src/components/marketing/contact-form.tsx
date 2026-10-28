"use client";

import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { contactRequestSchema } from "@/lib/validation/contact";

type FieldErrors = Partial<Record<string, string[]>>;

export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    const parsed = contactRequestSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setStatus("submitting");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(raw),
      });
      if (response.ok) {
        setStatus("sent");
        return;
      }
      const body = (await response.json().catch(() => ({}))) as { message?: string; fieldErrors?: FieldErrors };
      setErrors(body.fieldErrors ?? {});
      setMessage(body.message ?? "We could not send your message. Please try again.");
      setStatus("error");
    } catch {
      setMessage("We could not reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <Alert variant="success">
        <CheckCircle2Icon />
        <div>
          <AlertTitle>Thanks, we have your message.</AlertTitle>
          <AlertDescription>We will get back to you within one working day.</AlertDescription>
        </div>
      </Alert>
    );
  }

  const fieldError = (name: string) =>
    errors[name]?.[0] ? (
      <p id={`${name}-error`} className="text-xs text-destructive">
        {errors[name]?.[0]}
      </p>
    ) : null;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {status === "error" && message ? (
        <Alert variant="destructive">
          <AlertDescription className="mt-0">{message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Your name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required aria-invalid={Boolean(errors.fullName)} aria-describedby="fullName-error" />
          {fieldError("fullName")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clinicName">Clinic name</Label>
          <Input id="clinicName" name="clinicName" autoComplete="organization" />
          {fieldError("clinicName")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby="phone-error" />
          {fieldError("phone")}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} aria-describedby="email-error" />
          {fieldError("email")}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue="Mumbai" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="message">How can we help?</Label>
          <Textarea id="message" name="message" rows={4} maxLength={2000} />
          <p className="text-xs text-muted-foreground">Please don&apos;t include any patient information.</p>
        </div>
      </div>
      <div className="hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <Button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? <Loader2Icon className="animate-spin" /> : null}
        Send message
      </Button>
    </form>
  );
}
