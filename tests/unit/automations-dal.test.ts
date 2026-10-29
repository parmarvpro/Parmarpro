import { beforeEach, describe, expect, it, vi } from "vitest";

import { automationSettingsSchema, digestOptOutSchema } from "@/lib/validation/automations";
import type { Role } from "@/server/auth/permissions";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: () => mocks.auth() }));
vi.mock("@/server/db/user-client", () => ({
  createUserDb: () => ({ rpc: (...args: unknown[]) => mocks.rpc(...args), from: (...args: unknown[]) => mocks.from(...args) }),
}));
// React.cache would memoize across tests; use the plain function.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

const dal = await import("@/server/dal/automations");

// Synthetic identifiers only.
const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const CURSOR_ID = "33333333-3333-4333-8333-333333333333";

/** Signs in as a member of the clinic with the given role. */
function signedInAs(role: Role) {
  mocks.auth.mockResolvedValue({
    userId: "user_synthetic",
    orgId: "org_synthetic",
    orgRole: role === "owner" ? "org:admin" : "org:member",
    getToken: async () => "token",
  });
  mocks.rpc.mockImplementation(async (name: string) =>
    name === "my_membership"
      ? {
          data: [
            {
              clinic_id: CLINIC_ID,
              clinic_name: "Synthetic Clinic",
              clinic_city: "Mumbai",
              member_id: MEMBER_ID,
              role,
              display_name: null,
              entitled: true,
              trial_ends_at: null,
              paid_through: null,
            },
          ],
          error: null,
        }
      : { data: null, error: null },
  );
}

/** A thenable query that resolves to `result` after any chain of builder calls. */
function query(result: { data: unknown; error: null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "update", "eq", "maybeSingle"]) builder[method] = vi.fn(() => builder);
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<unknown>;
}

beforeEach(() => {
  mocks.auth.mockReset();
  mocks.rpc.mockReset();
  mocks.from.mockReset();
});

describe("updating automation settings", () => {
  it("refuses staff and viewers before anything is written", async () => {
    for (const role of ["staff", "viewer"] as const) {
      signedInAs(role);
      await expect(dal.updateAutomationSettings({ morning_digest: false })).rejects.toMatchObject({ code: "forbidden" });
    }
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("lets an admin change the settings in their own clinic", async () => {
    signedInAs("admin");
    const builder = query({ data: [{ clinic_id: CLINIC_ID }], error: null });
    mocks.from.mockReturnValue(builder);
    await expect(dal.updateAutomationSettings({ untouched_lead_hours: 24 })).resolves.toBeUndefined();
    expect(mocks.from).toHaveBeenCalledWith("clinic_automation_settings");
    expect(builder.update).toHaveBeenCalledWith({ untouched_lead_hours: 24 });
  });

  it("reports not found when the clinic has no settings row to change", async () => {
    signedInAs("owner");
    mocks.from.mockReturnValue(query({ data: [], error: null }));
    await expect(dal.updateAutomationSettings({ round_robin: true })).rejects.toMatchObject({ code: "not_found" });
  });

  it("refuses the server-owned round-robin cursor, even from an owner", async () => {
    signedInAs("owner");
    await expect(dal.updateAutomationSettings({ round_robin_last_member: CURSOR_ID })).rejects.toMatchObject({ code: "invalid_input" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("refuses an empty change", async () => {
    signedInAs("owner");
    await expect(dal.updateAutomationSettings({})).rejects.toMatchObject({ code: "invalid_input" });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("automation settings schema", () => {
  it("keeps hours between 12 and 168, as whole numbers", () => {
    expect(automationSettingsSchema.safeParse({ untouched_lead_hours: 11 }).success).toBe(false);
    expect(automationSettingsSchema.safeParse({ untouched_lead_hours: 12 }).success).toBe(true);
    expect(automationSettingsSchema.safeParse({ untouched_lead_hours: 168 }).success).toBe(true);
    expect(automationSettingsSchema.safeParse({ untouched_lead_hours: 169 }).success).toBe(false);
    expect(automationSettingsSchema.safeParse({ untouched_lead_hours: 12.5 }).success).toBe(false);
    expect(automationSettingsSchema.safeParse({ untouched_lead_hours: Number.NaN }).success).toBe(false);
  });

  it("keeps recall months between 1 and 24, as whole numbers", () => {
    expect(automationSettingsSchema.safeParse({ recall_months: 0 }).success).toBe(false);
    expect(automationSettingsSchema.safeParse({ recall_months: 1 }).success).toBe(true);
    expect(automationSettingsSchema.safeParse({ recall_months: 24 }).success).toBe(true);
    expect(automationSettingsSchema.safeParse({ recall_months: 25 }).success).toBe(false);
  });

  it("refuses values of the wrong type and keys it does not know", () => {
    expect(automationSettingsSchema.safeParse({ morning_digest: "yes" }).success).toBe(false);
    expect(automationSettingsSchema.safeParse({ enquiry_form_key: "a".repeat(64) }).success).toBe(false);
    expect(automationSettingsSchema.safeParse({ morning_digest: true, role: "owner" }).success).toBe(false);
  });

  it("accepts a single change, and the whole set", () => {
    expect(automationSettingsSchema.safeParse({ enquiry_form_enabled: true }).success).toBe(true);
    expect(
      automationSettingsSchema.safeParse({
        morning_digest: true,
        weekly_summary: true,
        untouched_lead_tasks: true,
        untouched_lead_hours: 48,
        no_show_tasks: true,
        round_robin: false,
        recall_tasks: false,
        recall_months: 6,
        patient_email_reminders: false,
        enquiry_form_enabled: false,
      }).success,
    ).toBe(true);
  });
});

describe("enquiry link and digest preference", () => {
  it("only owners and admins may replace the enquiry link", async () => {
    signedInAs("staff");
    await expect(dal.regenerateEnquiryFormKey()).rejects.toMatchObject({ code: "forbidden" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("regenerate_enquiry_form_key");

    signedInAs("admin");
    await expect(dal.regenerateEnquiryFormKey()).resolves.toBeUndefined();
    expect(mocks.rpc).toHaveBeenCalledWith("regenerate_enquiry_form_key");
  });

  it("any member, viewers included, can turn their own morning summary on or off", async () => {
    signedInAs("viewer");
    await expect(dal.setMyDigestOptOut(true)).resolves.toBeUndefined();
    expect(mocks.rpc).toHaveBeenCalledWith("set_my_digest_opt_out", { p_opt_out: true });
  });

  it("refuses a digest preference that is not a boolean, and writes nothing", async () => {
    signedInAs("viewer");
    await expect(dal.setMyDigestOptOut("yes")).rejects.toMatchObject({ code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalledWith("set_my_digest_opt_out", expect.anything());
    expect(digestOptOutSchema.safeParse("yes").success).toBe(false);
  });

  it("any member can read their own digest preference", async () => {
    signedInAs("viewer");
    mocks.from.mockReturnValue(query({ data: { digest_opt_out: true }, error: null }));
    await expect(dal.getMyDigestOptOut()).resolves.toBe(true);
    expect(mocks.from).toHaveBeenCalledWith("clinic_members");
  });

  it("reads the settings without the round-robin cursor", async () => {
    signedInAs("viewer");
    const builder = query({ data: { morning_digest: true }, error: null });
    mocks.from.mockReturnValue(builder);
    const result = await dal.getAutomationSettings();
    expect(result.role).toBe("viewer");
    expect(builder.select).toHaveBeenCalledWith(expect.not.stringContaining("round_robin_last_member"));
  });
});
