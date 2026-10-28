import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }));
vi.mock("@/server/db/user-client", () => ({
  createUserDb: () => ({ rpc: (...args: unknown[]) => rpcMock(...args) }),
}));
// React.cache would memoize across tests; use the plain function.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T,>(fn: T) => fn,
}));

const { requirePermission, getSessionState } = await import("@/server/auth/context");

function signedIn(orgId: string | null = "org_A1", orgRole: string | null = "org:member") {
  authMock.mockResolvedValue({ userId: "user_1", orgId, orgRole, getToken: async () => "token" });
}

function membership(role: string, entitled = true) {
  rpcMock.mockResolvedValue({
    data: [
      {
        clinic_id: "11111111-1111-4111-8111-111111111111",
        clinic_name: "Synthetic Clinic",
        clinic_city: "Mumbai",
        member_id: "22222222-2222-4222-8222-222222222222",
        role,
        display_name: null,
        entitled,
        trial_ends_at: null,
        paid_through: null,
      },
    ],
    error: null,
  });
}

beforeEach(() => {
  authMock.mockReset();
  rpcMock.mockReset();
});

describe("requirePermission", () => {
  it("rejects a signed-out caller with 401", async () => {
    authMock.mockResolvedValue({ userId: null, orgId: null, getToken: async () => null });
    await expect(requirePermission("lead:read")).rejects.toMatchObject({ code: "unauthenticated", status: 401 });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a caller without an active organization with 403", async () => {
    signedIn(null, null);
    await expect(requirePermission("lead:read")).rejects.toMatchObject({ code: "no_active_clinic", status: 403 });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects a caller whose organization has no membership row for them", async () => {
    signedIn();
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(requirePermission("lead:read")).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  it("rejects an unknown role value from the database (fail closed)", async () => {
    signedIn();
    membership("superuser");
    await expect(requirePermission("lead:read")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects a viewer attempting a write", async () => {
    signedIn();
    membership("viewer");
    await expect(requirePermission("lead:create")).rejects.toMatchObject({ code: "forbidden", status: 403 });
  });

  it("rejects staff attempting a delete or team change", async () => {
    signedIn();
    membership("staff");
    await expect(requirePermission("lead:delete")).rejects.toMatchObject({ code: "forbidden" });
    await expect(requirePermission("team:invite")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects an admin attempting to pay", async () => {
    signedIn();
    membership("admin");
    await expect(requirePermission("billing:pay")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects operational writes when the clinic is not entitled (402)", async () => {
    signedIn();
    membership("owner", false);
    await expect(requirePermission("lead:create")).rejects.toMatchObject({ code: "entitlement_required", status: 402 });
    await expect(requirePermission("lead:read")).resolves.toMatchObject({ role: "owner" });
    await expect(requirePermission("billing:pay")).resolves.toMatchObject({ role: "owner" });
  });

  it("returns the context for an authorized caller", async () => {
    signedIn();
    membership("staff");
    const ctx = await requirePermission("lead:create");
    expect(ctx).toMatchObject({ userId: "user_1", orgId: "org_A1", role: "staff", clinicName: "Synthetic Clinic" });
    expect(rpcMock).toHaveBeenCalledWith("my_membership");
  });

  it("maps database errors to safe errors", async () => {
    signedIn();
    rpcMock.mockResolvedValue({ data: null, error: { code: "XX000", message: "Failing row contains (secret)" } });
    const error = await requirePermission("lead:read").catch((e: unknown) => e);
    expect(error).toMatchObject({ code: "internal", status: 500 });
    expect((error as Error).message).not.toContain("secret");
  });
});

describe("getSessionState", () => {
  it("reports no_membership with the org role so onboarding can offer setup", async () => {
    signedIn("org_new1", "org:admin");
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(getSessionState()).resolves.toMatchObject({ kind: "no_membership", orgId: "org_new1", orgRole: "org:admin" });
  });
});
