import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { signToken, type LinkPurpose } from "@/server/signed-links";
import { answerEnquiryAction, emailOptOutAction, remindEnquiryAction } from "@/server/actions/email-links";
import * as privileged from "@/server/privileged/email-actions";

// next/navigation's redirect throws; the mock turns it into an error carrying the target URL.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/server/privileged/email-actions", () => ({
  markEnquiryAnswered: vi.fn(async () => true),
  remindEnquiryLater: vi.fn(async () => true),
  optOutDigest: vi.fn(async () => true),
  optOutPatientEmails: vi.fn(async () => ({ clinicName: "Synthetic Dental" })),
}));

// Test-only value, not a real secret.
const SECRET = "email_links_synthetic_test_value_0123456789"; // gitleaks:allow synthetic test value
const ENQUIRY_ID = "5f0c2a1e-7b1d-4c8e-9f3a-2d6b8e4c1a90";
const OTHER_ENQUIRY_ID = "0d9e8f7a-6b5c-4d3e-8f2a-1b0c9d8e7f6a";
const MEMBER_ID = "11111111-2222-4333-8444-555555555555";
const APPOINTMENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const FUTURE = Date.now() + 24 * 60 * 60 * 1000;
const PAST = Date.now() - 60 * 1000;

function token(purpose: LinkPurpose, subject: string, expiresAt = FUTURE): string {
  return signToken(SECRET, purpose, subject, expiresAt);
}

/** Runs an action and returns the URL it redirected to. Fails the test when it does not redirect. */
async function redirectOf(action: (formData: FormData) => Promise<void>, fields: Record<string, string>): Promise<string> {
  const formData = new FormData();
  for (const [name, value] of Object.entries(fields)) formData.append(name, value);
  try {
    await action(formData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("REDIRECT:")) return message.slice("REDIRECT:".length);
    throw error;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  vi.stubEnv("LINK_SIGNING_SECRET", SECRET);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("answerEnquiryAction", () => {
  it("a missing token is refused before the database is reached", async () => {
    expect(await redirectOf(answerEnquiryAction, { id: ENQUIRY_ID })).toBe("/");
    expect(privileged.markEnquiryAnswered).not.toHaveBeenCalled();
  });

  it("a malformed id is refused before the token is read", async () => {
    expect(await redirectOf(answerEnquiryAction, { id: "not-a-uuid", t: token("enquiry_action", "not-a-uuid") })).toBe("/");
    expect(privileged.markEnquiryAnswered).not.toHaveBeenCalled();
  });

  it("a token issued for another enquiry is refused, and the page is shown without the token", async () => {
    const url = await redirectOf(answerEnquiryAction, { id: OTHER_ENQUIRY_ID, t: token("enquiry_action", ENQUIRY_ID) });
    expect(url).toBe(`/ops/enquiry/${OTHER_ENQUIRY_ID}`);
    expect(privileged.markEnquiryAnswered).not.toHaveBeenCalled();
  });

  it("a digest token cannot answer an enquiry", async () => {
    const url = await redirectOf(answerEnquiryAction, { id: ENQUIRY_ID, t: token("digest_unsubscribe", MEMBER_ID) });
    expect(url).toBe(`/ops/enquiry/${ENQUIRY_ID}`);
    expect(privileged.markEnquiryAnswered).not.toHaveBeenCalled();
  });

  it("an expired token is refused", async () => {
    const url = await redirectOf(answerEnquiryAction, { id: ENQUIRY_ID, t: token("enquiry_action", ENQUIRY_ID, PAST) });
    expect(url).toBe(`/ops/enquiry/${ENQUIRY_ID}`);
    expect(privileged.markEnquiryAnswered).not.toHaveBeenCalled();
  });

  it("a valid token marks the enquiry answered once and redirects with done=answered", async () => {
    const t = token("enquiry_action", ENQUIRY_ID);
    expect(await redirectOf(answerEnquiryAction, { id: ENQUIRY_ID, t })).toBe(`/ops/enquiry/${ENQUIRY_ID}?t=${t}&done=answered`);
    expect(privileged.markEnquiryAnswered).toHaveBeenCalledTimes(1);
    expect(privileged.markEnquiryAnswered).toHaveBeenCalledWith(ENQUIRY_ID);
  });

  it("when no enquiry has the id, the page is shown without a confirmation", async () => {
    vi.mocked(privileged.markEnquiryAnswered).mockResolvedValueOnce(false);
    const t = token("enquiry_action", ENQUIRY_ID);
    expect(await redirectOf(answerEnquiryAction, { id: ENQUIRY_ID, t })).toBe(`/ops/enquiry/${ENQUIRY_ID}`);
  });
});

describe("remindEnquiryAction", () => {
  it("a token for another purpose is refused", async () => {
    const url = await redirectOf(remindEnquiryAction, { id: ENQUIRY_ID, t: token("patient_email_opt_out", APPOINTMENT_ID) });
    expect(url).toBe(`/ops/enquiry/${ENQUIRY_ID}`);
    expect(privileged.remindEnquiryLater).not.toHaveBeenCalled();
  });

  it("a valid token sets a three-day reminder once and redirects with done=reminder", async () => {
    const t = token("enquiry_action", ENQUIRY_ID);
    expect(await redirectOf(remindEnquiryAction, { id: ENQUIRY_ID, t })).toBe(`/ops/enquiry/${ENQUIRY_ID}?t=${t}&done=reminder`);
    expect(privileged.remindEnquiryLater).toHaveBeenCalledTimes(1);
    expect(privileged.remindEnquiryLater).toHaveBeenCalledWith(ENQUIRY_ID, 3);
    expect(privileged.markEnquiryAnswered).not.toHaveBeenCalled();
  });

  it("when no enquiry has the id, the page is shown without a confirmation", async () => {
    vi.mocked(privileged.remindEnquiryLater).mockResolvedValueOnce(false);
    const t = token("enquiry_action", ENQUIRY_ID);
    expect(await redirectOf(remindEnquiryAction, { id: ENQUIRY_ID, t })).toBe(`/ops/enquiry/${ENQUIRY_ID}`);
  });
});

describe("emailOptOutAction", () => {
  it("a missing token is refused and no helper is called", async () => {
    expect(await redirectOf(emailOptOutAction, {})).toBe("/email/preferences");
    expect(privileged.optOutDigest).not.toHaveBeenCalled();
    expect(privileged.optOutPatientEmails).not.toHaveBeenCalled();
  });

  it("an enquiry token cannot opt anyone out", async () => {
    const url = await redirectOf(emailOptOutAction, { t: token("enquiry_action", ENQUIRY_ID) });
    expect(url).toBe("/email/preferences");
    expect(privileged.optOutDigest).not.toHaveBeenCalled();
    expect(privileged.optOutPatientEmails).not.toHaveBeenCalled();
  });

  it("a tampered token is refused", async () => {
    const genuine = token("digest_unsubscribe", MEMBER_ID);
    const tampered = `${genuine.slice(0, -1)}${genuine.endsWith("A") ? "B" : "A"}`;
    expect(await redirectOf(emailOptOutAction, { t: tampered })).toBe("/email/preferences");
    expect(privileged.optOutDigest).not.toHaveBeenCalled();
  });

  it("a digest token stops the daily summary for its member only, once", async () => {
    const t = token("digest_unsubscribe", MEMBER_ID);
    expect(await redirectOf(emailOptOutAction, { t })).toBe(`/email/preferences?t=${t}&done=1`);
    expect(privileged.optOutDigest).toHaveBeenCalledTimes(1);
    expect(privileged.optOutDigest).toHaveBeenCalledWith(MEMBER_ID);
    expect(privileged.optOutPatientEmails).not.toHaveBeenCalled();
  });

  it("a patient token stops reminders for its appointment's patient only, once", async () => {
    const t = token("patient_email_opt_out", APPOINTMENT_ID);
    expect(await redirectOf(emailOptOutAction, { t })).toBe(`/email/preferences?t=${t}&done=1`);
    expect(privileged.optOutPatientEmails).toHaveBeenCalledTimes(1);
    expect(privileged.optOutPatientEmails).toHaveBeenCalledWith(APPOINTMENT_ID);
    expect(privileged.optOutDigest).not.toHaveBeenCalled();
  });

  it("a patient token for an unknown appointment is refused without a confirmation", async () => {
    vi.mocked(privileged.optOutPatientEmails).mockResolvedValueOnce(null);
    const t = token("patient_email_opt_out", APPOINTMENT_ID);
    expect(await redirectOf(emailOptOutAction, { t })).toBe("/email/preferences");
  });

  it("a digest token for an unknown member is refused without a confirmation", async () => {
    vi.mocked(privileged.optOutDigest).mockResolvedValueOnce(false);
    const t = token("digest_unsubscribe", MEMBER_ID);
    expect(await redirectOf(emailOptOutAction, { t })).toBe("/email/preferences");
  });
});
