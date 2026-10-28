import { describe, expect, it } from "vitest";

import { scrubBreadcrumb, scrubEvent, scrubString, scrubUrl } from "@/lib/observability/scrub";

const SYNTHETIC = {
  name: "Synthetic Patient Ramesh",
  email: "synthetic.patient@example.com",
  phone: "+919812345678",
  localPhone: "98123 45678",
  jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyXzEyMyJ9.c2lnbmF0dXJlc2lnbmF0dXJl", // gitleaks:allow synthetic test token
};

describe("scrubString", () => {
  it.each([
    [`contact ${SYNTHETIC.email}`, "contact [email]"],
    [`call ${SYNTHETIC.phone} now`, "call [phone] now"],
    [`call ${SYNTHETIC.localPhone}`, "call [phone]"],
    [`token ${SYNTHETIC.jwt}`, "token [jwt]"],
    ["key sk_test_FAKEFAKEFAKEFAKE", "key [key]"], // gitleaks:allow synthetic test value
    ["key sb_secret_abcdefghijkl", "key [key]"],
    ["key rzp_live_abcdefghij", "key [key]"],
    ["Authorization: Bearer abc.def.ghijklmnop", "Authorization: Bearer [token]"],
    ['Failing row contains (1, Synthetic Patient, +919812345678).', "Failing row contains ([redacted])."],
  ])("%s", (input, expected) => {
    expect(scrubString(input)).toBe(expected);
  });

  it("keeps ordinary text", () => {
    expect(scrubString("TypeError: cannot read properties of undefined")).toBe("TypeError: cannot read properties of undefined");
  });
});

describe("scrubUrl", () => {
  it("drops query strings and replaces record ids", () => {
    expect(scrubUrl("https://app.parmarpro.in/dashboard/leads/3f2c1a2b-1111-4111-8111-111111111111?q=Ramesh&phone=98")).toBe(
      "https://app.parmarpro.in/dashboard/leads/[id]",
    );
    expect(scrubUrl("/dashboard/patients?q=synthetic")).toBe("/dashboard/patients");
  });
});

describe("scrubEvent", () => {
  it("removes request bodies, cookies, headers, user and local variables", () => {
    const event = scrubEvent({
      message: `Failed for ${SYNTHETIC.email}`,
      request: {
        url: "https://x.test/dashboard/leads?q=Synthetic",
        data: { fullName: SYNTHETIC.name, phone: SYNTHETIC.phone },
        cookies: { __session: SYNTHETIC.jwt },
        headers: { authorization: `Bearer ${SYNTHETIC.jwt}` },
        query_string: "q=Synthetic",
      },
      user: { email: SYNTHETIC.email, ip_address: "1.2.3.4" },
      extra: { input: { fullName: SYNTHETIC.name, note: "free text" }, count: 3 },
      exception: { values: [{ value: `Error for ${SYNTHETIC.phone}`, stacktrace: { frames: [{ vars: { patient: SYNTHETIC.name } }] } }] },
      breadcrumbs: [
        { category: "console", message: `log ${SYNTHETIC.email}` },
        { category: "fetch", data: { url: "/api/contact?email=x", method: "POST", status_code: 500, body: SYNTHETIC.name } },
        { category: "ui.input", message: SYNTHETIC.name },
      ],
    });
    const serialized = JSON.stringify(event);
    for (const value of Object.values(SYNTHETIC)) expect(serialized).not.toContain(value);
    expect(event.request).toEqual({ url: "https://x.test/dashboard/leads" });
    expect(event.user).toBeUndefined();
    expect(event.breadcrumbs).toEqual([{ category: "fetch", data: { url: "/api/contact", method: "POST", status_code: 500 } }]);
    expect(event.extra).toEqual({ input: { fullName: "[redacted]", note: "[redacted]" }, count: 3 });
  });

  it("drops console breadcrumbs", () => {
    expect(scrubBreadcrumb({ category: "console", message: "x" })).toBeNull();
  });
});
