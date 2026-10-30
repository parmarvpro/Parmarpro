import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AI_NEVER_SENT, AI_PROMPTS, aiHelpState, type AiHelpState } from "@/lib/ai-help";
import { paidLaneConfigured } from "@/server/ai/configured";
import { getAutomationSettings } from "@/server/dal/automations";

export const metadata: Metadata = { title: "AI help" };

const STATUS: Record<AiHelpState, { label: string; detail: string }> = {
  off: {
    label: "Off",
    detail: "AI help is off. No enquiry is sent to Gemini, and no prompt can run.",
  },
  not_connected: {
    label: "On, not connected",
    detail: "AI help is on, but the Gemini service is not set up for ParmarPro yet, so nothing is sent and nothing runs.",
  },
  on: {
    label: "On",
    detail: "Gemini is connected. Staff run the prompts below, and every result is a suggestion to check before acting.",
  },
};

export default async function AiHelpPage() {
  const { settings } = await getAutomationSettings();
  const state = aiHelpState({ enabled: settings.ai_enquiry_help, configured: paidLaneConfigured() });

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="AI help"
        description="Gemini suggests and staff decide. Nothing is sent to an enquirer or a patient automatically."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <div className="space-y-1">
              <CardTitle>Status</CardTitle>
              <CardDescription>{STATUS[state].label}</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/settings/automations">Open Automations</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{STATUS[state].detail}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prompts staff can run</CardTitle>
            <CardDescription>These are the only prompts ParmarPro sends to Gemini for a clinic.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {AI_PROMPTS.map((prompt) => (
              <section key={prompt.id} className="space-y-3 border-t pt-6 first:border-t-0 first:pt-0">
                <h2 className="text-base font-semibold">{prompt.name}</h2>
                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
                  <dt className="text-muted-foreground">Where</dt>
                  <dd>{prompt.where}</dd>
                  <dt className="text-muted-foreground">Gemini receives</dt>
                  <dd>{prompt.receives}</dd>
                  <dt className="text-muted-foreground">Gemini returns</dt>
                  <dd>{prompt.returns}</dd>
                  <dt className="text-muted-foreground">Who can run it</dt>
                  <dd>{prompt.runBy}</dd>
                </dl>
              </section>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Never sent to Gemini</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              {AI_NEVER_SENT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
