"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isEnquiryLinkFor, readPreferenceLink } from "@/server/automations/email-links";
import { markEnquiryAnswered, optOutDigest, optOutPatientEmails, remindEnquiryLater } from "@/server/privileged/email-actions";

/**
 * Actions behind the links in automation emails. There is no login here: the
 * signed token in `t` is the authority, and every action verifies it again.
 * Hidden form fields are never trusted on their own.
 */

const REMINDER_DAYS = 3;
const MAX_TOKEN_LENGTH = 512;

const enquiryForm = z.object({
  id: z.uuid(),
  t: z.string().min(1).max(MAX_TOKEN_LENGTH),
});

const preferenceForm = z.object({
  t: z.string().min(1).max(MAX_TOKEN_LENGTH),
});

function enquiryUrl(id: string, t?: string, done?: "answered" | "reminder"): string {
  const params = new URLSearchParams();
  if (t) params.set("t", t);
  if (done) params.set("done", done);
  const query = params.toString();
  return query ? `/ops/enquiry/${id}?${query}` : `/ops/enquiry/${id}`;
}

function preferencesUrl(t?: string, done?: "1"): string {
  const params = new URLSearchParams();
  if (t) params.set("t", t);
  if (done) params.set("done", done);
  const query = params.toString();
  return query ? `/email/preferences?${query}` : "/email/preferences";
}

export async function answerEnquiryAction(formData: FormData): Promise<void> {
  const form = enquiryForm.safeParse({ id: formData.get("id"), t: formData.get("t") });
  if (!form.success) redirect("/");
  const { id, t } = form.data;
  if (!isEnquiryLinkFor(t, id)) redirect(enquiryUrl(id));
  if (!(await markEnquiryAnswered(id))) redirect(enquiryUrl(id));
  redirect(enquiryUrl(id, t, "answered"));
}

export async function remindEnquiryAction(formData: FormData): Promise<void> {
  const form = enquiryForm.safeParse({ id: formData.get("id"), t: formData.get("t") });
  if (!form.success) redirect("/");
  const { id, t } = form.data;
  if (!isEnquiryLinkFor(t, id)) redirect(enquiryUrl(id));
  if (!(await remindEnquiryLater(id, REMINDER_DAYS))) redirect(enquiryUrl(id));
  redirect(enquiryUrl(id, t, "reminder"));
}

/** Stops the email the token was issued for: the staff digest, or appointment reminders from one clinic. */
export async function emailOptOutAction(formData: FormData): Promise<void> {
  const form = preferenceForm.safeParse({ t: formData.get("t") });
  const link = form.success ? readPreferenceLink(form.data.t) : null;
  if (!form.success || link === null) redirect(preferencesUrl());
  const stopped =
    link.kind === "digest" ? await optOutDigest(link.memberId) : (await optOutPatientEmails(link.appointmentId)) !== null;
  if (!stopped) redirect(preferencesUrl());
  redirect(preferencesUrl(form.data.t, "1"));
}
