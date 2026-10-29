import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportError } from "@/lib/observability/report";
import { revokeInClerk, createExpireInvitationsJob, type ExpireInvitationsDeps } from "@/server/jobs/expire-invitations";
import type { ExpirableInvitation } from "@/server/privileged/jobs";

const { revokeOrganizationInvitation } = vi.hoisted(() => ({ revokeOrganizationInvitation: vi.fn() }));

vi.mock("@/lib/observability/report", () => ({ reportError: vi.fn() }));
vi.mock("@/server/privileged/client", () => ({
  privilegedDb: () => {
    throw new Error("privileged client must not be used in this test");
  },
}));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ organizations: { revokeOrganizationInvitation } }),
}));

const NOW = new Date("2026-10-29T20:00:00Z");

function invitation(overrides: Partial<ExpirableInvitation> = {}): ExpirableInvitation {
  return {
    id: "inv-1",
    clinic_id: "clinic-a",
    clerk_invitation_id: "orginv_1",
    invited_by: "user_owner",
    clerk_org_id: "org_A",
    ...overrides,
  };
}

function harness(options: { invitations?: ExpirableInvitation[]; revokeFails?: boolean; markExpired?: boolean } = {}) {
  const deps = {
    expiredInvitations: vi.fn<ExpireInvitationsDeps["expiredInvitations"]>(async () => options.invitations ?? [invitation()]),
    revokeInClerk: vi.fn<ExpireInvitationsDeps["revokeInClerk"]>(async () => {
      if (options.revokeFails) throw new Error("synthetic clerk failure");
    }),
    markExpired: vi.fn<ExpireInvitationsDeps["markExpired"]>(async () => options.markExpired ?? true),
  };
  return { deps, job: createExpireInvitationsJob(deps) };
}

beforeEach(() => {
  vi.mocked(reportError).mockClear();
  revokeOrganizationInvitation.mockReset();
});

describe("expire-invitations", () => {
  it("revokes the Clerk invitation as the inviting owner, then expires the row", async () => {
    const { deps, job } = harness();
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ expired: 1 });
    expect(deps.revokeInClerk).toHaveBeenCalledWith({
      organizationId: "org_A",
      invitationId: "orginv_1",
      requestingUserId: "user_owner",
    });
    expect(deps.markExpired).toHaveBeenCalledWith("inv-1");
    expect(deps.revokeInClerk.mock.invocationCallOrder[0]).toBeLessThan(deps.markExpired.mock.invocationCallOrder[0] ?? 0);
  });

  it("still expires the row when Clerk fails, and counts and reports the Clerk failure", async () => {
    const { deps, job } = harness({ revokeFails: true });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ clerk_error: 1, expired: 1 });
    expect(deps.markExpired).toHaveBeenCalledWith("inv-1");
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.expire-invitations", code: "clerk_revoke" });
  });

  it("expires an invitation that has no Clerk id without calling Clerk", async () => {
    const { deps, job } = harness({ invitations: [invitation({ clerk_invitation_id: null })] });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ expired: 1 });
    expect(deps.revokeInClerk).not.toHaveBeenCalled();
  });

  it("dry run revokes and expires nothing", async () => {
    const { deps, job } = harness({ invitations: [invitation(), invitation({ id: "inv-2" })] });
    await expect(job({ now: NOW, dryRun: true })).resolves.toEqual({ would_expire: 2 });
    expect(deps.revokeInClerk).not.toHaveBeenCalled();
    expect(deps.markExpired).not.toHaveBeenCalled();
  });

  it("counts an invitation that was no longer pending as already_changed", async () => {
    const { job } = harness({ markExpired: false });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ already_changed: 1 });
  });

  it("counts a failing invitation as an error and still processes the next one", async () => {
    const { deps, job } = harness({ invitations: [invitation(), invitation({ id: "inv-2", clerk_invitation_id: null })] });
    deps.markExpired.mockImplementationOnce(async () => {
      throw new Error("synthetic database failure");
    });
    await expect(job({ now: NOW, dryRun: false })).resolves.toEqual({ errors: 1, expired: 1 });
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { area: "jobs.expire-invitations" });
  });

  it("the production Clerk revocation passes the organization, invitation and inviter", async () => {
    revokeOrganizationInvitation.mockResolvedValue({});
    await revokeInClerk({ organizationId: "org_A", invitationId: "orginv_1", requestingUserId: "user_owner" });
    expect(revokeOrganizationInvitation).toHaveBeenCalledWith({
      organizationId: "org_A",
      invitationId: "orginv_1",
      requestingUserId: "user_owner",
    });
  });
});
