import { describe, expect, it } from "vitest";

import { JOBS } from "@/server/jobs/registry";

describe("job registry", () => {
  it("registers exactly the five scheduled jobs", () => {
    expect(Object.keys(JOBS).sort()).toEqual(
      ["expire-invitations", "staff-digest", "weekly-summary", "patient-reminders", "founder-digest"].sort(),
    );
  });
});
