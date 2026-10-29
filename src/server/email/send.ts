import "server-only";

import { emailEnv, isConfigured } from "@/lib/env";
import { reportError } from "@/lib/observability/report";

export type EmailContent = { subject: string; text: string; html: string };

export type SendResult = { ok: true; id: string | null } | { ok: false; reason: "not_configured" | "rejected" | "network" };

export type EmailSender = {
  send(params: { to: string; content: EmailContent; replyTo?: string }): Promise<SendResult>;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

/**
 * Sends through the Resend HTTP API. Never logs or reports the recipient, the
 * subject or the body: only the status code or the error class.
 */
export function createEmailSender(deps: { fetch: typeof fetch; apiKey: string; from: string }): EmailSender {
  return {
    async send({ to, content, replyTo }) {
      let response: Response;
      try {
        response = await deps.fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${deps.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: deps.from,
            to: [to],
            subject: content.subject,
            text: content.text,
            html: content.html,
            ...(replyTo ? { reply_to: replyTo } : {}),
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch {
        // The thrown error is not forwarded: its message can echo request details.
        reportError(new Error("email_network"), { area: "email.send", code: "network" });
        return { ok: false, reason: "network" };
      }
      if (!response.ok) {
        reportError(new Error("email_rejected"), { area: "email.send", code: String(response.status) });
        return { ok: false, reason: "rejected" };
      }
      const body = (await response.json().catch(() => null)) as { id?: unknown } | null;
      return { ok: true, id: typeof body?.id === "string" ? body.id : null };
    },
  };
}

let sender: EmailSender | undefined;

/** The configured sender, or null when the email settings are missing or invalid. */
function activeSender(): EmailSender | null {
  if (sender) return sender;
  if (!isConfigured(emailEnv)) return null;
  const { RESEND_API_KEY, EMAIL_FROM } = emailEnv();
  sender = createEmailSender({
    fetch: (input, init) => fetch(input, init),
    apiKey: RESEND_API_KEY,
    from: EMAIL_FROM,
  });
  return sender;
}

export async function sendEmail(params: { to: string; content: EmailContent; replyTo?: string }): Promise<SendResult> {
  const active = activeSender();
  if (!active) return { ok: false, reason: "not_configured" };
  return active.send(params);
}
