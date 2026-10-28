import "server-only";

import { clerkClient } from "@clerk/nextjs/server";

import { publicEnv } from "@/lib/env";
import { reportError } from "@/lib/observability/report";
import { inviteSchema, roleChangeSchema, uuidField } from "@/lib/validation/entities";
import { requirePermission } from "@/server/auth/context";
import { AppError } from "@/server/auth/errors";
import { assignableRoles, clerkRoleFor } from "@/server/auth/permissions";
import { throwIfDbError } from "@/server/db/errors";
import { parseInput } from "@/server/validation";

export async function listTeam() {
  const ctx = await requirePermission("team:read");
  const members = await ctx.db
    .from("clinic_members")
    .select("id, clerk_user_id, role, status, display_name, created_at")
    .eq("status", "active")
    .order("created_at");
  throwIfDbError(members.error);

  let invitations: { id: string; email: string; role: string; status: string; created_at: string }[] = [];
  if (ctx.role === "owner" || ctx.role === "admin") {
    const result = await ctx.db
      .from("clinic_invitations")
      .select("id, email, role, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    throwIfDbError(result.error);
    invitations = result.data ?? [];
  }
  return {
    members: members.data ?? [],
    invitations,
    me: { userId: ctx.userId, role: ctx.role },
    assignable: assignableRoles(ctx.role),
  };
}

/** Active members for assignee pickers. */
export async function listAssignableMembers() {
  const ctx = await requirePermission("team:read");
  const { data, error } = await ctx.db
    .from("clinic_members")
    .select("id, display_name, role")
    .eq("status", "active")
    .order("display_name");
  throwIfDbError(error);
  return data ?? [];
}

/**
 * Invites a team member. Order matters:
 * 1. The database records the invitation (and enforces who may assign
 *    which role) using the caller's own token.
 * 2. Clerk sends the invitation email for the caller's verified active
 *    organization. If that fails, the database invitation is revoked.
 */
export async function inviteMember(rawInput: unknown): Promise<{ invitationId: string; role: string }> {
  const ctx = await requirePermission("team:invite");
  const input = parseInput(inviteSchema, rawInput);
  if (!assignableRoles(ctx.role).includes(input.role)) throw new AppError("forbidden");

  const { data: invitationId, error } = await ctx.db.rpc("create_invitation", { p_email: input.email, p_role: input.role });
  throwIfDbError(error);

  try {
    const clerk = await clerkClient();
    const invitation = await clerk.organizations.createOrganizationInvitation({
      organizationId: ctx.orgId,
      emailAddress: input.email,
      role: clerkRoleFor(input.role),
      inviterUserId: ctx.userId,
      publicMetadata: { parmarpro_invitation_id: invitationId as string },
      redirectUrl: `${publicEnv.NEXT_PUBLIC_APP_URL}/onboarding`,
    });
    const { error: attachError } = await ctx.db.rpc("attach_clerk_invitation", {
      p_invitation_id: invitationId as string,
      p_clerk_invitation_id: invitation.id,
    });
    throwIfDbError(attachError);
  } catch (clerkError) {
    await ctx.db.rpc("revoke_invitation", { p_invitation_id: invitationId as string });
    reportError(clerkError, { area: "team.invite" });
    throw new AppError("internal", { cause: clerkError });
  }
  return { invitationId: invitationId as string, role: input.role };
}

export async function revokeInvitation(rawId: unknown): Promise<void> {
  const ctx = await requirePermission("team:invite");
  const id = parseInput(uuidField, rawId);
  const { data: clerkInvitationId, error } = await ctx.db.rpc("revoke_invitation", { p_invitation_id: id });
  throwIfDbError(error);
  if (clerkInvitationId) {
    try {
      const clerk = await clerkClient();
      await clerk.organizations.revokeOrganizationInvitation({
        organizationId: ctx.orgId,
        invitationId: clerkInvitationId as string,
        requestingUserId: ctx.userId,
      });
    } catch (clerkError) {
      // The database invitation is already revoked, so it can no longer grant a role.
      reportError(clerkError, { area: "team.revokeInvitation" });
    }
  }
}

export async function changeMemberRole(rawInput: unknown): Promise<void> {
  const ctx = await requirePermission("team:change_role");
  const input = parseInput(roleChangeSchema, rawInput);
  // Rules (no self-change, admins manage staff/viewers only, last owner) are
  // enforced by the database function. Roles that can be assigned here never
  // map to a different Clerk role (only owners are org:admin), so Clerk needs
  // no update.
  const { error } = await ctx.db.rpc("change_member_role", { p_member_id: input.memberId, p_new_role: input.role });
  throwIfDbError(error);
}

export async function removeMember(rawId: unknown): Promise<void> {
  const ctx = await requirePermission("team:remove");
  const memberId = parseInput(uuidField, rawId);
  const { data: clerkUserId, error } = await ctx.db.rpc("remove_member", { p_member_id: memberId });
  throwIfDbError(error);
  // Access already ends now (membership inactive). Also remove the Clerk
  // membership so the user's token stops carrying this organization.
  try {
    const clerk = await clerkClient();
    await clerk.organizations.deleteOrganizationMembership({ organizationId: ctx.orgId, userId: clerkUserId as string });
  } catch (clerkError) {
    reportError(clerkError, { area: "team.removeMember" });
  }
}
