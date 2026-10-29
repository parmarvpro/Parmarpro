import "server-only";

import { reportError } from "@/lib/observability/report";
import { clerkRecipientLookup, type RecipientLookup } from "@/server/email/recipients";
import { welcomeEmail } from "@/server/email/templates";
import { clinicTrialEndsAt } from "@/server/privileged/email-actions";
import { notifier, type SendOnceParams, type SendOutcome } from "@/server/privileged/notifications";

const AREA = "automations.welcome";

export type WelcomeParams = { clinicId: string; userId: string; clinicName: string };

export type WelcomeDeps = {
  lookup: RecipientLookup;
  trialEndsAt: (clinicId: string) => Promise<Date | null>;
  sendOnce: (params: SendOnceParams) => Promise<SendOutcome>;
  report: (error: unknown, context: { area: string }) => void;
};

/** Builds the welcome sender. Nothing is sent without an email address or a trial end date. */
export function createWelcomeSender(deps: WelcomeDeps): (params: WelcomeParams) => Promise<void> {
  return async ({ clinicId, userId, clinicName }) => {
    try {
      const recipient = (await deps.lookup([userId])).get(userId);
      if (!recipient) return;
      const trialEndsAt = await deps.trialEndsAt(clinicId);
      if (!trialEndsAt) return;
      await deps.sendOnce({
        kind: "welcome",
        clinicId,
        subjectKey: clinicId,
        periodKey: "once",
        to: recipient.email,
        content: welcomeEmail({ firstName: recipient.firstName, clinicName, trialEndsAt }),
        dryRun: false,
      });
    } catch (error) {
      deps.report(error, { area: AREA });
    }
  };
}

/** Welcome email to the person who created a clinic. Best-effort: never throws. */
export function sendWelcome(params: WelcomeParams): Promise<void> {
  return createWelcomeSender({
    lookup: clerkRecipientLookup(),
    trialEndsAt: clinicTrialEndsAt,
    sendOnce: (sendParams) => notifier().sendOnce(sendParams),
    report: reportError,
  })(params);
}
