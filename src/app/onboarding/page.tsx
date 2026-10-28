import { OrganizationList, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <UserButton />
      </header>
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
