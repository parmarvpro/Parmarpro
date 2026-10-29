import { describe, expect, it } from "vitest";

import { JOBS } from "@/server/jobs/registry";

describe("job registry", () => {
  it("registers exactly the seven scheduled jobs", () => {
    expect(Object.keys(JOBS).sort()).toEqual(
      [
        "reconcile-payments",
        "expire-invitations",
        "trial-renewal",
        "staff-digest",
        "weekly-summary",
        "patient-reminders",
        "founder-digest",
      ].sort(),
    );
  });
});
