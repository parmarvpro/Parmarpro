import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { flattenSearchParams } from "@/lib/search-params";
import { emailOptOutAction } from "@/server/actions/email-links";
import { readPreferenceLink } from "@/server/automations/email-links";
import { appointmentClinicName } from "@/server/privileged/email-actions";

/**
 * Opened from the links in automation emails. No login: the signed link is the
 * authority. The page shows only what the link is for. Patient names and emails
 * are never shown.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Email preferences",
  robots: { index: false, follow: false },
};

type View =
  | { kind: "invalid" }
  | { kind: "done" }
  | { kind: "digest"; token: string }
  | { kind: "patient"; token: string; clinicName: string };

async function viewFor(token: string | undefined, done: string | undefined): Promise<View> {
  const link = readPreferenceLink(token);
  if (!token || !link) return { kind: "invalid" };
  if (done === "1") return { kind: "done" };
  if (link.kind === "digest") return { kind: "digest", token };
  const clinicName = await appointmentClinicName(link.appointmentId);
  return clinicName === null ? { kind: "invalid" } : { kind: "patient", token, clinicName };
}

function Body({ view }: { view: View }) {
  switch (view.kind) {
    case "invalid":
      return (
        <>
          <p className="text-ink-600">This link is invalid or has expired.</p>
          <Button asChild variant="outline">
            <Link href="/">Go to the home page</Link>
          </Button>
        </>
      );
    case "done":
      return (
        <p role="status" className="text-ink-900">
          Done. You will not receive these emails any more.
        </p>
      );
    case "digest":
      return (
        <>
          <p className="text-ink-900">Stop the daily summary emails for this ParmarPro account?</p>
          <form action={emailOptOutAction}>
            <input type="hidden" name="t" value={view.token} />
            <Button type="submit">Stop daily summary emails</Button>
          </form>
        </>
      );
    case "patient":
      return (
        <>
          <p className="text-ink-900">Stop appointment reminder emails from {view.clinicName}?</p>
          <form action={emailOptOutAction}>
            <input type="hidden" name="t" value={view.token} />
            <Button type="submit">Stop appointment reminders</Button>
          </form>
        </>
      );
  }
}

export default async function EmailPreferencesPage({ searchParams }: PageProps<"/email/preferences">) {
  const { t, done } = flattenSearchParams(await searchParams);
  const view = await viewFor(t, done);
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div className="space-y-6 rounded-3xl border border-brand-500/30 bg-white p-6 sm:p-8">
        <div className="space-y-2">
          <p className="eyebrow">Email preferences</p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">ParmarPro emails</h1>
        </div>
        <Body view={view} />
      </div>
    </div>
  );
}
