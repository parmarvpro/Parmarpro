import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateTime, formatPhone } from "@/lib/format";
import { flattenSearchParams } from "@/lib/search-params";
import { answerEnquiryAction, remindEnquiryAction } from "@/server/actions/email-links";
import { isEnquiryLinkFor } from "@/server/automations/email-links";
import { getEnquiry, type EnquiryDetail } from "@/server/privileged/email-actions";

/**
 * Opened from the founder alert email. No login: the signed link in `t` is the
 * authority. Anything other than a valid link for this enquiry is a 404.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Enquiry",
  robots: { index: false, follow: false },
};

function statusLabel(enquiry: EnquiryDetail): string {
  if (enquiry.handled_at) return `Answered on ${formatDateTime(enquiry.handled_at)}`;
  if (enquiry.follow_up_at) return `Reminder set for ${formatDateTime(enquiry.follow_up_at)}`;
  return "Open";
}

function confirmation(done: string | undefined): string | null {
  switch (done) {
    case "answered":
      return "Marked as answered.";
    case "reminder":
      return "Done. We will remind you in 3 days.";
    default:
      return null;
  }
}

export default async function EnquiryPage({ params, searchParams }: PageProps<"/ops/enquiry/[id]">) {
  const { id } = await params;
  const { t, done } = flattenSearchParams(await searchParams);
  if (!t || !isEnquiryLinkFor(t, id)) notFound();
  const enquiry = await getEnquiry(id);
  if (!enquiry) notFound();

  const message = confirmation(done);
  const rows: Array<[string, string]> = [
    ["Clinic", enquiry.clinic_name ?? "—"],
    ["Phone", formatPhone(enquiry.phone_e164)],
    ["Email", enquiry.email ?? "—"],
    ["City", enquiry.city ?? "—"],
    ["Received", formatDateTime(enquiry.created_at)],
  ];

  return (
    <main id="main" className="flex min-h-screen items-start justify-center bg-white px-4 py-12 sm:px-6">
      <div className="w-full max-w-xl space-y-6">
        <Logo />
        <Card>
          <CardContent className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="eyebrow">Enquiry</p>
              <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{enquiry.full_name}</h1>
              <p className="text-sm text-muted-foreground">{statusLabel(enquiry)}</p>
            </div>

            {message ? (
              <p role="status" className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
                {message}
              </p>
            ) : null}

            <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 break-words text-ink-900">{value}</dd>
                </div>
              ))}
            </dl>

            {enquiry.message ? (
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Message</p>
                <p className="whitespace-pre-wrap break-words text-ink-900">{enquiry.message}</p>
              </div>
            ) : null}

            {enquiry.handled_at ? null : (
              <div className="flex flex-wrap gap-3">
                <form action={answerEnquiryAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="t" value={t} />
                  <Button type="submit">Mark as answered</Button>
                </form>
                <form action={remindEnquiryAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="t" value={t} />
                  <Button type="submit" variant="outline">
                    Remind me in 3 days
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
