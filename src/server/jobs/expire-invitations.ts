import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import { reportError } from "@/lib/observability/report";
import type { JobFn } from "@/server/jobs/registry";
import { createTally, forEachItem } from "@/server/jobs/tally";
import { expiredInvitations, markInvitationExpired, type ExpirableInvitation } from "@/server/privileged/jobs";

const AREA = "jobs.expire-invitations";

export type RevokeInClerk = (params: {
  organizationId: string;
  invitationId: string;
  requestingUserId: string;
}) => Promise<void>;

export type ExpireInvitationsDeps = {
  expiredInvitations: (now: Date) => Promise<ExpirableInvitation[]>;
  revokeInClerk: RevokeInClerk;
  /** False when the invitation was no longer pending. */
  markExpired: (id: string) => Promise<boolean>;
};

/**
 * Expires invitations that were never accepted within 7 days. The Clerk
 * invitation is revoked first, and the row is expired even when Clerk fails, so
 * an old invitation can no longer grant a role in either system.
 */
export function createExpireInvitationsJob(deps: ExpireInvitationsDeps): JobFn {
  return async ({ now, dryRun }) => {
    const tally = createTally();
    const invitations = await deps.expiredInvitations(now);
    await forEachItem(invitations, tally, AREA, async (invitation) => {
      if (dryRun) {
        tally.add("would_expire");
        return;
      }
      if (invitation.clerk_invitation_id !== null) {
        try {
          await deps.revokeInClerk({
            organizationId: invitation.clerk_org_id,
            invitationId: invitation.clerk_invitation_id,
            requestingUserId: invitation.invited_by,
          });
        } catch (error) {
          tally.add("clerk_error");
          reportError(error, { area: AREA, code: "clerk_revoke" });
        }
      }
      tally.add((await deps.markExpired(invitation.id)) ? "expired" : "already_changed");
    });
    return tally.result();
  };
}

/** Clerk revocation, as in revokeInvitation in src/server/dal/team.ts. */
export const revokeInClerk: RevokeInClerk = async ({ organizationId, invitationId, requestingUserId }) => {
  const clerk = await clerkClient();
  await clerk.organizations.revokeOrganizationInvitation({ organizationId, invitationId, requestingUserId });
};

export const expireInvitationsJob: JobFn = async (ctx) =>
  createExpireInvitationsJob({
    expiredInvitations,
    revokeInClerk,
    markExpired: markInvitationExpired,
  })(ctx);
