import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { EnquiryForm } from "@/components/enquiry/enquiry-form";
import { Card, CardContent } from "@/components/ui/card";
import { MissingConfigurationError } from "@/lib/env";
import { reportError } from "@/lib/observability/report";
import { submitEnquiryAction } from "@/server/actions/enquiry";
import { findEnquiryClinic, type EnquiryClinic } from "@/server/privileged/enquiry";

/**
 * Public website enquiry form for one clinic. There is no login: the key in the
 * path is the only lookup. A wrong key, a switched-off form, an archived or
 * unpaid clinic and a failed lookup all show the same not-found page. Failed
 * lookups are reported, never shown to the visitor.
 */
export const dynamic = "force-dynamic";

// Shared by generateMetadata and the page, so each request looks the clinic up once.
const loadClinic = cache(async (key: string): Promise<EnquiryClinic | null> => {
  try {
    return await findEnquiryClinic(key);
  } catch (error) {
    // While the database is not connected the form is simply unavailable (404), which is expected, not a fault.
    if (!(error instanceof MissingConfigurationError)) reportError(error, { area: "enquiry.page" });
    return null;
  }
});

export async function generateMetadata({ params }: PageProps<"/enquire/[key]">): Promise<Metadata> {
  const { key } = await params;
  const clinic = await loadClinic(key);
  return {
    title: clinic ? `Enquiry for ${clinic.clinicName}` : "Enquiry",
    robots: { index: false, follow: false },
  };
}

export default async function EnquiryPage({ params }: PageProps<"/enquire/[key]">) {
  const { key } = await params;
  const clinic = await loadClinic(key);
  if (!clinic) notFound();

  const submit = submitEnquiryAction.bind(null, key);
  return (
    <main id="main" className="min-h-screen bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-ink-900">Enquiry for {clinic.clinicName}</h1>
          <p className="text-sm text-ink-600">
            Tell us how to reach you and what you need. {clinic.clinicName} will use these details to contact you about this enquiry.
          </p>
        </header>
        <Card>
          <CardContent className="p-5 sm:p-6">
            <EnquiryForm clinicName={clinic.clinicName} action={submit} />
          </CardContent>
        </Card>
        <p className="text-center text-xs text-ink-500">Powered by ParmarPro</p>
      </div>
    </main>
  );
}
