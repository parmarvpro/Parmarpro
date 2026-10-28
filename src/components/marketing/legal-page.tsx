import { AlertTriangleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Set to true only after a qualified lawyer has reviewed the privacy notice
 * and terms (see docs/deployment.md, launch checklist).
 */
export const LEGAL_TEXT_REVIEWED = false;

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>
      {!LEGAL_TEXT_REVIEWED ? (
        <Alert variant="warning" className="mt-6">
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
      <div className="mt-8 space-y-6 text-[15px] leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:mt-1.5 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-muted-foreground">
        {children}
      </div>
    </article>
  );
}
