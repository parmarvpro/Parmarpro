import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import { reportError } from "@/lib/observability/report";
import { privilegedDb } from "@/server/privileged/client";

/**
 * Turns a verified Clerk organization membership that came from a ParmarPro
 * invitation into an app membership with the invited role.
 *
 * Trust: `userId` and `orgId` come from the verified Clerk session (auth())
 * or a Svix-verified webhook. Emails are read from the Clerk Backend API and
 * only verified addresses are considered. The database function then
 * requires a pending invitation for exactly that clinic and email.
 *
 * Returns true when a membership was created.
 */
export async function reconcileInvitedMembership(params: { userId: string; orgId: string }): Promise<boolean> {
  const clerk = await clerkClient();
  const memberships = await clerk.organizations.getOrganizationMembershipList({
    organizationId: params.orgId,
    userId: [params.userId],
  });
  if (memberships.data.length === 0) return false;

  const user = await clerk.users.getUser(params.userId);
  const verifiedEmails = user.emailAddresses
    .filter((address) => address.verification?.status === "verified")
    .map((address) => address.emailAddress.toLowerCase());
  const displayName = user.fullName ?? user.firstName ?? null;

  const db = privilegedDb();
  for (const email of verifiedEmails) {
    const { error } = await db.rpc("accept_invitation_membership", {
      p_clerk_org_id: params.orgId,
      p_clerk_user_id: params.userId,
      p_email: email,
      p_display_name: displayName ?? undefined,
    });
    if (!error) return true;
    if (error.code !== "P0002") {
      reportError(error, { area: "membership.reconcile", code: error.code });
      return false;
    }
  }
  return false;
}

/** Clerk webhook: membership deleted → deactivate app membership. */
export async function deactivateMembershipFromClerk(orgId: string, userId: string): Promise<void> {
  const { error } = await privilegedDb().rpc("deactivate_membership_from_clerk", {
    p_clerk_org_id: orgId,
    p_clerk_user_id: userId,
  });
  if (error) throw error;
}

/** Clerk webhook: organization deleted → archive the clinic (data retained until deletion request). */
export async function archiveClinicFromClerk(orgId: string): Promise<void> {
  const { error } = await privilegedDb().rpc("archive_clinic_from_clerk", { p_clerk_org_id: orgId });
  if (error) throw error;
}
