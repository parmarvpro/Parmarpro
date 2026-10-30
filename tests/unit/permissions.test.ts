import { describe, expect, it } from "vitest";

import {
  assignableRoles,
  checkRoleChange,
  clerkRoleFor,
  hasPermission,
  PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
} from "@/server/auth/permissions";

/** Expected matrix from docs/security-plan.md §2. Every cell is asserted. */
const READ_ONLY: Permission[] = [
  "dashboard:read", "clinic:read", "team:read", "lead:read", "patient:read",
  "appointment:read", "task:read", "activity:read",
];
const OPERATE: Permission[] = [
  "lead:create", "lead:update", "patient:create", "patient:update",
  "appointment:create", "appointment:update", "task:create", "task:update",
];
const MANAGE: Permission[] = [
  "lead:delete", "patient:archive", "appointment:delete", "task:delete", "clinic:update",
  "team:invite", "team:change_role", "team:remove",
];

const EXPECTED: Record<Role, Set<Permission>> = {
  owner: new Set([...READ_ONLY, ...OPERATE, ...MANAGE]),
  admin: new Set([...READ_ONLY, ...OPERATE, ...MANAGE]),
  staff: new Set([...READ_ONLY, ...OPERATE]),
  viewer: new Set(READ_ONLY),
};

describe("permission matrix", () => {
  for (const role of ROLES) {
    for (const permission of PERMISSIONS) {
      const expected = EXPECTED[role].has(permission);
      it(`${role} ${expected ? "can" : "cannot"} ${permission}`, () => {
        expect(hasPermission(role, permission)).toBe(expected);
      });
    }
  }

  it("viewers have no write permission at all", () => {
    const writes = PERMISSIONS.filter((p) => !p.endsWith(":read"));
    expect(writes.filter((p) => hasPermission("viewer", p))).toEqual([]);
  });
});

describe("role assignment rules", () => {
  it("owners assign admin/staff/viewer, admins assign staff/viewer, others nothing", () => {
    expect(assignableRoles("owner")).toEqual(["admin", "staff", "viewer"]);
    expect(assignableRoles("admin")).toEqual(["staff", "viewer"]);
    expect(assignableRoles("staff")).toEqual([]);
    expect(assignableRoles("viewer")).toEqual([]);
  });

  const base = { actorUserId: "user_a", targetUserId: "user_b", activeOwnerCount: 1 };

  it.each([
    ["owner promotes staff to admin", { actorRole: "owner", targetRole: "staff", newRole: "admin" }, { ok: true }],
    ["admin moves viewer to staff", { actorRole: "admin", targetRole: "viewer", newRole: "staff" }, { ok: true }],
    ["admin promotes staff to admin", { actorRole: "admin", targetRole: "staff", newRole: "admin" }, { ok: false, reason: "new_role_not_assignable" }],
    ["admin demotes another admin", { actorRole: "admin", targetRole: "admin", newRole: "staff" }, { ok: false, reason: "target_role_not_manageable" }],
    ["admin removes the owner", { actorRole: "admin", targetRole: "owner", newRole: null }, { ok: false, reason: "last_owner" }],
    ["staff changes a viewer", { actorRole: "staff", targetRole: "viewer", newRole: "staff" }, { ok: false, reason: "not_permitted" }],
    ["owner makes someone owner", { actorRole: "owner", targetRole: "admin", newRole: "owner" }, { ok: false, reason: "new_role_not_assignable" }],
  ] as const)("%s", (_name, change, expected) => {
    expect(checkRoleChange({ ...base, ...change })).toEqual(expected);
  });

  it("nobody can change themselves", () => {
    expect(
      checkRoleChange({ actorRole: "owner", actorUserId: "user_a", targetUserId: "user_a", targetRole: "owner", newRole: "admin", activeOwnerCount: 2 }),
    ).toEqual({ ok: false, reason: "self_change" });
  });

  it("maps only owners to Clerk org:admin", () => {
    expect(ROLES.map(clerkRoleFor)).toEqual(["org:admin", "org:member", "org:member", "org:member"]);
  });
});
