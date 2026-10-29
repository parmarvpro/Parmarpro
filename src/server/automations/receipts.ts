import "server-only";

import { reportError } from "@/lib/observability/report";
import type { PaymentApplied } from "@/server/billing/reconcile";
import { clerkRecipientLookup, type RecipientLookup } from "@/server/email/recipients";
import { paymentReceiptEmail } from "@/server/email/templates";
import { clinicOwnersAndName } from "@/server/privileged/email-actions";
import { notifier, type SendOnceParams, type SendOutcome } from "@/server/privileged/notifications";

const AREA = "automations.receipt";

export type ReceiptDeps = {
  owners: (clinicId: string) => Promise<{ clinicName: string; ownerUserIds: string[] } | null>;
  lookup: RecipientLookup;
  sendOnce: (params: SendOnceParams) => Promise<SendOutcome>;
  report: (error: unknown, context: { area: string }) => void;
  now: () => Date;
};

/**
 * Builds the receipt sender: one receipt per active clinic owner with an email
 * address. The notification key includes the owner, so a repeated call for the
 * same payment sends nothing new.
 */
export function createPaymentReceipts(deps: ReceiptDeps): (info: PaymentApplied) => Promise<void> {
  return async (info) => {
    try {
      const clinic = await deps.owners(info.clinicId);
      if (!clinic || clinic.ownerUserIds.length === 0) return;
      const recipients = await deps.lookup(clinic.ownerUserIds);
      const now = deps.now();
      for (const userId of clinic.ownerUserIds) {
        await sendReceipt({ deps, info, clinicName: clinic.clinicName, now, recipient: recipients.get(userId), userId });
      }
    } catch (error) {
      deps.report(error, { area: AREA });
    }
  };
}

async function sendReceipt(params: {
  deps: ReceiptDeps;
  info: PaymentApplied;
  clinicName: string;
  now: Date;
  recipient: { email: string } | undefined;
  userId: string;
}): Promise<void> {
  const { deps, info, clinicName, now, recipient, userId } = params;
  if (!recipient) return;
  try {
    await deps.sendOnce({
      kind: "payment_receipt",
      clinicId: info.clinicId,
      subjectKey: `${info.providerPaymentId}:${userId}`,
      periodKey: "once",
      to: recipient.email,
      content: paymentReceiptEmail({
        clinicName,
        amountPaise: info.amountPaise,
        paidThrough: info.paidThrough ? new Date(info.paidThrough) : now,
        providerPaymentId: info.providerPaymentId,
        paidAt: now,
      }),
      dryRun: false,
    });
  } catch (error) {
    // One owner's failure must not stop the others.
    deps.report(error, { area: AREA });
  }
}

/** Payment receipts for the owners of the clinic that paid. Best-effort: never throws. */
export function sendPaymentReceipts(info: PaymentApplied): Promise<void> {
  return createPaymentReceipts({
    owners: clinicOwnersAndName,
    lookup: clerkRecipientLookup(),
    sendOnce: (params) => notifier().sendOnce(params),
    report: reportError,
    now: () => new Date(),
  })(info);
}
