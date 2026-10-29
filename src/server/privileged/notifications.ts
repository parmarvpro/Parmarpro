import "server-only";

import { emailEnv, isConfigured } from "@/lib/env";
import { istDayStart } from "@/lib/ist";
import { reportError } from "@/lib/observability/report";
import { sendEmail, type EmailContent, type SendResult } from "@/server/email/send";
import { privilegedDb } from "@/server/privileged/client";

/**
 * PRIVILEGED notification log. Each reminder is claimed in notification_log
 * before it is sent, so a (kind, subject, period) is sent at most once. A failed
 * send releases its claim so a later run can retry it.
 */

/** Emails per IST day across all clinics. A runaway job stops here instead of exhausting the provider quota. */
export const EMAIL_DAILY_BUDGET = 90;

export type SendOutcome = "sent" | "duplicate" | "failed" | "budget_exhausted" | "not_configured" | "dry_run";

export type NotificationKey = { kind: string; clinicId: string | null; subjectKey: string; periodKey: string };

export type SendOnceParams = NotificationKey & { to: string; content: EmailContent; dryRun: boolean };

export type NotifierDeps = {
  /** Inserts the key. False when it already exists. */
  claim(key: NotificationKey): Promise<boolean>;
  release(key: NotificationKey): Promise<void>;
  alreadySent(key: NotificationKey): Promise<boolean>;
  sentSince(since: Date): Promise<number>;
  send(to: string, content: EmailContent): Promise<SendResult>;
  configured(): boolean;
  now(): Date;
};

export type Notifier = { sendOnce(params: SendOnceParams): Promise<SendOutcome> };

export function createNotifier(deps: NotifierDeps): Notifier {
  return {
    async sendOnce({ kind, clinicId, subjectKey, periodKey, to, content, dryRun }) {
      const key: NotificationKey = { kind, clinicId, subjectKey, periodKey };
      if (!deps.configured()) return "not_configured";
      if (dryRun) return (await deps.alreadySent(key)) ? "duplicate" : "dry_run";
      if ((await deps.sentSince(istDayStart(deps.now()))) >= EMAIL_DAILY_BUDGET) return "budget_exhausted";
      if (!(await deps.claim(key))) return "duplicate";

      let result: SendResult;
      try {
        result = await deps.send(to, content);
      } catch (error) {
        // sendEmail reports failures as results, so a throw here is a defect. Treat it as a failed send.
        reportError(error, { area: "notifications.send", code: "throw" });
        result = { ok: false, reason: "network" };
      }
      if (result.ok) return "sent";
      await deps.release(key);
      return "failed";
    },
  };
}

function defaultDeps(): NotifierDeps {
  return {
    async claim(key) {
      const { error } = await privilegedDb().from("notification_log").insert({
        kind: key.kind,
        clinic_id: key.clinicId,
        subject_key: key.subjectKey,
        period_key: key.periodKey,
      });
      if (!error) return true;
      if (error.code === "23505") return false;
      throw error;
    },
    async release(key) {
      const { error } = await privilegedDb()
        .from("notification_log")
        .delete()
        .eq("kind", key.kind)
        .eq("subject_key", key.subjectKey)
        .eq("period_key", key.periodKey);
      if (error) throw error;
    },
    async alreadySent(key) {
      const { data, error } = await privilegedDb()
        .from("notification_log")
        .select("id")
        .eq("kind", key.kind)
        .eq("subject_key", key.subjectKey)
        .eq("period_key", key.periodKey)
        .maybeSingle();
      if (error) throw error;
      return data !== null;
    },
    async sentSince(since) {
      const { count, error } = await privilegedDb()
        .from("notification_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    send: (to, content) => sendEmail({ to, content }),
    configured: () => isConfigured(emailEnv),
    now: () => new Date(),
  };
}

let shared: Notifier | undefined;

/** Process-wide notifier backed by the privileged client. Built on first use. */
export function notifier(): Notifier {
  shared ??= createNotifier(defaultDeps());
  return shared;
}
