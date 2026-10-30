import { describe, expect, it } from "vitest";

import { ANALYTICS_EVENTS, routeTemplate, sanitizeCapture, validateEvent } from "@/lib/analytics/events";

describe("analytics event schema", () => {
  it("accepts allowlisted properties only", () => {
    expect(validateEvent("lead_created", { source: "whatsapp" })).toEqual({ source: "whatsapp" });
    expect(validateEvent("lead_created", { source: "whatsapp", fullName: "Synthetic Patient" } as never)).toBeNull();
    expect(validateEvent("lead_created", { source: "not-a-source" } as never)).toBeNull();
    expect(validateEvent("payment_verified" as never, { plan: "parmarpro_clinic_monthly" } as never)).toBeNull();
    expect(validateEvent("page_viewed", { route: "/dashboard/leads?q=Synthetic" })).toBeNull();
  });

  it("every event schema is strict (rejects unknown keys)", () => {
    for (const [name, schema] of Object.entries(ANALYTICS_EVENTS)) {
      expect(schema.safeParse({ email: "synthetic@example.com" }).success, name).toBe(false);
    }
  });

  it("reduces paths to route templates without ids or query strings", () => {
    expect(routeTemplate("/dashboard/leads/3f2c1a2b-1111-4111-8111-111111111111")).toBe("/dashboard/leads/[id]");
    expect(routeTemplate("/dashboard/patients")).toBe("/dashboard/patients");
  });
});

describe("sanitizeCapture (PostHog before_send)", () => {
  it("drops events outside the schema", () => {
    expect(sanitizeCapture({ event: "$autocapture", properties: {} })).toBeNull();
    expect(sanitizeCapture({ event: "$pageview", properties: {} })).toBeNull();
    expect(sanitizeCapture({ event: "custom_event", properties: {} })).toBeNull();
  });

  it("removes URL, referrer and campaign properties, including person properties", () => {
    const result = sanitizeCapture({
      event: "lead_created",
      properties: {
        source: "whatsapp",
        $current_url: "https://app.example/dashboard/leads?q=Synthetic%20Patient",
        $pathname: "/dashboard/leads",
        $referrer: "https://app.example/dashboard/patients?q=98123",
        utm_source: "x",
        $browser: "Chrome",
        $set_once: { $initial_current_url: "https://app.example/?q=Synthetic", $initial_referrer: "x" },
      },
      $set: { $current_url: "https://app.example/?q=Synthetic" },
    });
    expect(JSON.stringify(result)).not.toContain("Synthetic");
    expect(JSON.stringify(result)).not.toContain("98123");
    expect(result?.properties).toMatchObject({ source: "whatsapp", $browser: "Chrome" });
  });

  it("keeps identify events", () => {
    expect(sanitizeCapture({ event: "$identify", properties: { distinct_id: "abc" } })).not.toBeNull();
  });
});
