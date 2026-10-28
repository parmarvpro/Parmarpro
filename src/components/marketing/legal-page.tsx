import { AlertTriangleIcon } from "lucide-react";

import { EyebrowTag } from "@/components/brand/eyebrow-tag";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Set to true only after a qualified lawyer has reviewed the privacy notice
 * and terms (see docs/deployment.md, launch checklist).
 */
export const LEGAL_TEXT_REVIEWED = false;

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="space-y-4 border-b border-hairline pb-8">
        <EyebrowTag tone="soft">Legal</EyebrowTag>
        <h1 className="headline text-[clamp(1.75rem,4.2vw+0.4rem,3.75rem)] text-brand-500">{title}</h1>
        <p className="text-sm text-ink-500">Last updated {updated}</p>
      </div>
      {!LEGAL_TEXT_REVIEWED ? (
        <Alert variant="warning" className="mt-8">
          <AlertTriangleIcon />
          <div>
            <AlertTitle>Draft pending legal review</AlertTitle>
            <AlertDescription>
              This document describes how ParmarPro currently works, but it has not yet been reviewed by a lawyer and may
              change before general availability.
            </AlertDescription>
          </div>
        </Alert>
      ) : null}
      <div className="mt-8 space-y-6 text-base leading-relaxed text-ink-800 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-brand-700 [&_li]:mt-1.5 [&_p]:text-ink-600 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-ink-600 [&_ul]:marker:text-brand-500">
        {children}
      </div>
    </article>
  );
}
