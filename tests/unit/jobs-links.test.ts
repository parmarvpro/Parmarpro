import { afterEach, describe, expect, it, vi } from "vitest";

import { publicEnv } from "@/lib/env";
import { digestUnsubscribeUrl, enquiryManageUrl, patientOptOutUrlBuilder } from "@/server/jobs/links";
import { readSignedLink } from "@/server/signed-links";

// Test-only value, not a real secret.
const SECRET = "link_signing_synthetic_test_value_0123456789"; // gitleaks:allow synthetic test value
const APP = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");

function tokenOf(url: string): string | null {
  return new URL(url).searchParams.get("t");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("digest unsubscribe link", () => {
  it("falls back to the automation settings when link signing is not configured", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", "");
    expect(digestUnsubscribeUrl("member-1")).toBe(`${APP}/dashboard/settings/automations`);
  });

  it("is a signed, expiring link to the preferences page for this member only", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", SECRET);
    const url = digestUnsubscribeUrl("member-1");
    expect(url.startsWith(`${APP}/email/preferences?t=`)).toBe(true);
    expect(readSignedLink(tokenOf(url) ?? undefined, "digest_unsubscribe")).toEqual({ subject: "member-1" });
    expect(readSignedLink(tokenOf(url) ?? undefined, "patient_email_opt_out")).toBeNull();
  });
});

describe("enquiry link in the founder digest", () => {
  it("falls back to the dashboard, so the digest still goes out", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", "");
    expect(enquiryManageUrl("enquiry-1")).toBe(`${APP}/dashboard`);
  });

  it("is a signed link to the enquiry", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", SECRET);
    const url = enquiryManageUrl("enquiry-1");
    expect(url.startsWith(`${APP}/ops/enquiry/enquiry-1?t=`)).toBe(true);
    expect(readSignedLink(tokenOf(url) ?? undefined, "enquiry_action")).toEqual({ subject: "enquiry-1" });
  });
});

describe("patient opt-out link", () => {
  it("is unavailable when link signing is not configured, so no reminder is sent", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", "");
    expect(patientOptOutUrlBuilder()).toBeNull();
  });

  it("is a signed link per appointment", () => {
    vi.stubEnv("LINK_SIGNING_SECRET", SECRET);
    const build = patientOptOutUrlBuilder();
    expect(build).not.toBeNull();
    const url = build?.("appt-1") ?? "";
    expect(url.startsWith(`${APP}/email/preferences?t=`)).toBe(true);
    expect(readSignedLink(tokenOf(url) ?? undefined, "patient_email_opt_out")).toEqual({ subject: "appt-1" });
  });
});
