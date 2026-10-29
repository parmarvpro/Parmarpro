import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import { createEmailSender, sendEmail, type EmailContent } from "@/server/email/send";

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));

// Test-only values, not real credentials.
const API_KEY = "re_test_0123456789abcdef";
const FROM = "ParmarPro <hello@example.com>";
const RECIPIENT = "jane.patient@example.com";
const CONTENT: EmailContent = { subject: "Your reminder", text: "Text body", html: "<p>HTML body</p>" };

function firstCall(mock: { mock: { calls: unknown[][] } }): unknown[] {
  const call = mock.mock.calls[0];
  if (!call) throw new Error("expected a call");
  return call;
}

/** Everything the reporter received, flattened to text, so leaks are visible. */
function reportedText(): string {
  return vi
    .mocked(reportError)
    .mock.calls.map(([error, context]) => {
      const { name, message } = error as Error;
      return JSON.stringify({ name, message, context });
    })
    .join("\n");
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createEmailSender", () => {
  it("posts the message to Resend with the bearer key and the expected body", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ id: "em_123" }, { status: 200 }));
    const sender = createEmailSender({ fetch: fetchMock, apiKey: API_KEY, from: FROM });

    const result = await sender.send({ to: RECIPIENT, content: CONTENT, replyTo: "help@example.com" });

    expect(result).toEqual({ ok: true, id: "em_123" });
    const [url, init] = firstCall(fetchMock) as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    expect(headers["content-type"]).toBe("application/json");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init.body))).toEqual({
      from: FROM,
      to: [RECIPIENT],
      subject: "Your reminder",
      text: "Text body",
      html: "<p>HTML body</p>",
      reply_to: "help@example.com",
    });
  });

  it("omits reply_to when none is given", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ id: "em_1" }));
    const sender = createEmailSender({ fetch: fetchMock, apiKey: API_KEY, from: FROM });

    await sender.send({ to: RECIPIENT, content: CONTENT });

    const [, init] = firstCall(fetchMock) as [string, RequestInit];
    expect(JSON.parse(String(init.body))).not.toHaveProperty("reply_to");
  });

  it("returns a null id when a successful response has no JSON body", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("", { status: 200 }));
    const sender = createEmailSender({ fetch: fetchMock, apiKey: API_KEY, from: FROM });
    await expect(sender.send({ to: RECIPIENT, content: CONTENT })).resolves.toEqual({ ok: true, id: null });
  });

  it("reports a non-2xx response as rejected, with the status code only", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ message: `bad address ${RECIPIENT}` }, { status: 422 }));
    const sender = createEmailSender({ fetch: fetchMock, apiKey: API_KEY, from: FROM });

    await expect(sender.send({ to: RECIPIENT, content: CONTENT })).resolves.toEqual({ ok: false, reason: "rejected" });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "email.send", code: "422" });
    expect(reportedText()).toContain("email_rejected");
  });

  it("maps a thrown fetch error to a network failure", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new TypeError("socket hang up");
    });
    const sender = createEmailSender({ fetch: fetchMock, apiKey: API_KEY, from: FROM });

    await expect(sender.send({ to: RECIPIENT, content: CONTENT })).resolves.toEqual({ ok: false, reason: "network" });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "email.send", code: "network" });
  });

  it("never passes the recipient, subject or body to the reporter", async () => {
    const failures = [
      vi.fn<typeof fetch>(async () => Response.json({ message: `rejected ${RECIPIENT}` }, { status: 500 })),
      vi.fn<typeof fetch>(async () => {
        throw new TypeError(`could not deliver to ${RECIPIENT} about "Your reminder" Text body`);
      }),
    ];
    for (const fetchMock of failures) {
      const sender = createEmailSender({ fetch: fetchMock, apiKey: API_KEY, from: FROM });
      await sender.send({ to: RECIPIENT, content: CONTENT });
    }

    expect(reportError).toHaveBeenCalledTimes(2);
    const reported = reportedText();
    expect(reported).not.toContain(RECIPIENT);
    expect(reported).not.toContain("Your reminder");
    expect(reported).not.toContain("Text body");
    expect(reported).not.toContain(API_KEY);
  });
});

describe("sendEmail", () => {
  it("returns not_configured without calling the network when the email settings are missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    try {
      await expect(sendEmail({ to: RECIPIENT, content: CONTENT })).resolves.toEqual({ ok: false, reason: "not_configured" });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
