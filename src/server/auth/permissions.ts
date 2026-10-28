/**
 * Canonical application permission matrix (see docs/security-plan.md §2).
 *
 * This module is pure and has no server dependencies so it can be unit tested
 * exhaustively and shared with UI code for display decisions. Display
 * decisions are never security decisions: every server operation calls
 * requirePermission(), and PostgreSQL RLS enforces the same rules again.
 */

export const ROLES = ["owner", "admin", "staff", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard:read",
  "clinic:read",
  "clinic:update",
  "team:read",
  "team:invite",
  "team:change_role",
  "team:remove",
  "lead:read",
  "lead:create",
  "lead:update",
  "lead:delete",
  "patient:read",
  "patient:create",
  "patient:update",
  "patient:archive",
  "appointment:read",
  "appointment:create",
  "appointment:update",
  "appointment:delete",
  "task:read",
  "task:create",
  "task:update",
  "task:delete",
  "activity:read",
  "billing:read",
  "billing:pay",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const READ: Permission[] = [
  "dashboard:read",
  "clinic:read",
  "team:read",
  "lead:read",
  "patient:read",
  "appointment:read",
  "task:read",
  "activity:read",
];

const OPERATE: Permission[] = [
  "lead:create",
  "lead:update",
  "patient:create",
  "patient:update",
  "appointment:create",
  "appointment:update",
  "task:create",
  "task:update",
];

const MANAGE: Permission[] = [
  "lead:delete",
  "patient:archive",
  "appointment:delete",
  "task:delete",
  "clinic:update",
  "team:invite",
  "team:change_role",
  "team:remove",
  "billing:read",
];

const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set([...READ, ...OPERATE, ...MANAGE, "billing:pay"]),
  admin: new Set([...READ, ...OPERATE, ...MANAGE]),
  staff: new Set([...READ, ...OPERATE]),
  viewer: new Set(READ),
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return MATRIX[role].has(permission);
}

/** Roles an actor may assign to (or remove from) other members. */
export function assignableRoles(actor: Role): readonly Role[] {
  switch (actor) {
    case "owner":
      return ["admin", "staff", "viewer"];
    case "admin":
      return ["staff", "viewer"];
    default:
      return [];
  }
}

export type RoleChangeCheck =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "self_change"
        | "not_permitted"
        | "target_role_not_manageable"
        | "new_role_not_assignable"
        | "last_owner";
    };

/**
 * Mirrors the rules enforced by the change_member_role / remove_member RPCs.
 * `newRole` is null for a removal.
 */
export function checkRoleChange(params: {
  actorRole: Role;
  actorUserId: string;
  targetUserId: string;
  targetRole: Role;
  newRole: Role | null;
  activeOwnerCount: number;
}): RoleChangeCheck {
  const { actorRole, actorUserId, targetUserId, targetRole, newRole, activeOwnerCount } = params;
  const permission: Permission = newRole === null ? "team:remove" : "team:change_role";
  if (!hasPermission(actorRole, permission)) return { ok: false, reason: "not_permitted" };
  if (actorUserId === targetUserId) return { ok: false, reason: "self_change" };
  if (targetRole === "owner" && activeOwnerCount <= 1) return { ok: false, reason: "last_owner" };
  const manageable = assignableRoles(actorRole);
  if (!manageable.includes(targetRole)) return { ok: false, reason: "target_role_not_manageable" };
  if (newRole !== null && !manageable.includes(newRole)) {
    return { ok: false, reason: "new_role_not_assignable" };
  }
  return { ok: true };
}

/** Clerk organization role that corresponds to an app role. */
export function clerkRoleFor(role: Role): "org:admin" | "org:member" {
  return role === "owner" ? "org:admin" : "org:member";
}
