import { beforeEach, describe, expect, it, vi } from "vitest";

import { completeClinicSetup } from "@/server/actions/onboarding";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  scheduleAfter: vi.fn(),
  sendWelcome: vi.fn(),
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, currentUser: mocks.currentUser }));
vi.mock("@/server/db/user-client", () => ({ createUserDb: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/server/automations/schedule", () => ({ scheduleAfter: mocks.scheduleAfter }));
vi.mock("@/server/automations/welcome", () => ({ sendWelcome: mocks.sendWelcome }));
vi.mock("@/server/privileged/membership", () => ({ reconcileInvitedMembership: vi.fn() }));

const CLINIC_ID = "9b1f7c2e-4a3d-4e5f-8a6b-1c2d3e4f5a6b";
const USER_ID = "user_owner_synthetic";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: USER_ID, orgId: "org_synthetic", orgRole: "org:admin", getToken: async () => "token" });
  mocks.currentUser.mockResolvedValue({ fullName: "Synthetic Owner", firstName: "Synthetic" });
  mocks.rpc.mockResolvedValue({ data: CLINIC_ID, error: null });
});

describe("completeClinicSetup and the welcome email", () => {
  it("returns the clinic id and schedules the welcome for the creating user after the response", async () => {
    await expect(completeClinicSetup({ name: "Synthetic Dental", city: "Pune" })).resolves.toEqual({
      ok: true,
      data: { clinicId: CLINIC_ID },
    });

    expect(mocks.scheduleAfter).toHaveBeenCalledTimes(1);
    expect(mocks.sendWelcome).not.toHaveBeenCalled();
    const [scheduled] = mocks.scheduleAfter.mock.calls[0] ?? [];
    await (scheduled as () => Promise<void>)();
    expect(mocks.sendWelcome).toHaveBeenCalledWith({ clinicId: CLINIC_ID, userId: USER_ID, clinicName: "Synthetic Dental" });
  });

  it("schedules nothing when the clinic could not be created", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "not allowed" } });
    const result = await completeClinicSetup({ name: "Synthetic Dental", city: "Pune" });
    expect(result).toMatchObject({ ok: false, code: "forbidden" });
    expect(mocks.scheduleAfter).not.toHaveBeenCalled();
  });

  it("schedules nothing when the input is invalid", async () => {
    const result = await completeClinicSetup({ name: "", city: "Pune" });
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.scheduleAfter).not.toHaveBeenCalled();
  });
});
