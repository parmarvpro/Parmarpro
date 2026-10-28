import { OrganizationList, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EyebrowTag } from "@/components/brand/eyebrow-tag";
import { Halftone } from "@/components/brand/halftone";
import { Sparkle } from "@/components/brand/sparkle";
import { Logo } from "@/components/logo";
import { ClaimInvitation } from "@/components/onboarding/claim-invitation";
import { ClinicSetupForm } from "@/components/onboarding/clinic-setup-form";
import { RegistrationTracker } from "@/components/onboarding/registration-tracker";
import { AnalyticsProvider } from "@/components/providers/analytics-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { publicEnv } from "@/lib/env";
import { analyticsIdFor } from "@/server/analytics-id";
import { getSessionState } from "@/server/auth/context";

export const metadata: Metadata = { title: "Set up your clinic" };

export default async function OnboardingPage() {
  const state = await getSessionState();
  if (state.kind === "signed_out") redirect("/sign-in");
  if (state.kind === "member") redirect("/dashboard");

  const session = await auth();
  const isOrgAdmin = state.kind === "no_membership" && session.orgRole === "org:admin";

  return (
    <AnalyticsProvider
      apiKey={publicEnv.NEXT_PUBLIC_POSTHOG_KEY}
      apiHost={publicEnv.NEXT_PUBLIC_POSTHOG_HOST}
      analyticsUserId={analyticsIdFor(state.userId)}
      clinicId={null}
    >
    {state.kind === "no_org" ? <RegistrationTracker /> : null}
    <div className="flex min-h-screen flex-col bg-white">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <UserButton />
      </header>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand-500 text-white">
          <Halftone map="corner" inverse className="absolute inset-0" />
          <Sparkle tone="white" className="absolute -top-6 right-4 hidden size-44 sm:block" />
          <div className="relative space-y-3 p-8 md:p-10">
            <EyebrowTag tone="inverse">Welcome to ParmarPro</EyebrowTag>
            <h1 className="headline max-w-xl text-3xl sm:text-4xl">Let&apos;s get your clinic set up</h1>
            <p className="max-w-lg text-sm">Create your workspace, or join the clinic that invited you.</p>
          </div>
        </div>
      </div>
      <main id="main" className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 pt-6 pb-16 sm:px-6 md:grid-cols-2">
        {state.kind === "no_membership" && !isOrgAdmin ? (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>You have joined a clinic organization</CardTitle>
              <CardDescription>
                Confirm to activate your access. Your role is the one your clinic chose when it invited you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClaimInvitation />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{isOrgAdmin ? "Finish setting up your clinic" : "Create your clinic workspace"}</CardTitle>
              <CardDescription>
                You will be the owner. Your 14-day trial starts now, and you can invite your team afterwards.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClinicSetupForm existingOrgName={isOrgAdmin ? (session.orgSlug ?? undefined) : undefined} />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Joining an existing clinic?</CardTitle>
            <CardDescription>Accept your invitation or switch to a clinic you already belong to.</CardDescription>
          </CardHeader>
          <CardContent>
            <OrganizationList
              hidePersonal
              afterSelectOrganizationUrl="/dashboard"
              afterCreateOrganizationUrl="/onboarding"
              skipInvitationScreen={false}
            />
          </CardContent>
        </Card>
      </main>
    </div>
    </AnalyticsProvider>
  );
}
