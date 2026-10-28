import "server-only";

import { auth } from "@clerk/nextjs/server";
import { cache } from "react";

import { AppError } from "@/server/auth/errors";
import { hasPermission, isRole, requiresEntitlement, type Permission, type Role } from "@/server/auth/permissions";
import { createUserDb, type UserDb } from "@/server/db/user-client";
import { mapDbError } from "@/server/db/errors";

export type AuthContext = {
  userId: string;
  orgId: string;
  clinicId: string;
  clinicName: string;
  clinicCity: string;
  memberId: string;
  role: Role;
  displayName: string | null;
  entitled: boolean;
  trialEndsAt: string | null;
  paidThrough: string | null;
  /** Later of trial end and paid-through, and whether it is within 7 days. */
  accessEndsAt: string | null;
  accessEndsSoon: boolean;
  onTrial: boolean;
  /** Supabase client acting as this user under RLS. */
  db: UserDb;
};

export type SessionState =
  | { kind: "signed_out" }
  | { kind: "no_org"; userId: string }
  | { kind: "no_membership"; userId: string; orgId: string; orgRole: string | null; db: UserDb }
  | { kind: "member"; ctx: AuthContext };

/**
 * Resolves the caller's identity from the verified Clerk session and their
 * clinic membership from the database (through RLS, using their own token).
 * Never trusts client-supplied clinic or organization ids.
 *
 * Memoized per request with React `cache`.
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const session = await auth();
  if (!session.userId) return { kind: "signed_out" };
  if (!session.orgId) return { kind: "no_org", userId: session.userId };

  const db = createUserDb(() => session.getToken());
  const { data, error } = await db.rpc("my_membership");
  if (error) throw mapDbError(error);

  const row = data?.[0];
  if (!row || !isRole(row.role)) {
    return { kind: "no_membership", userId: session.userId, orgId: session.orgId, orgRole: session.orgRole ?? null, db };
  }

  const access = accessWindow(row.trial_ends_at ?? null, row.paid_through ?? null);
  return {
    kind: "member",
    ctx: {
      userId: session.userId,
      orgId: session.orgId,
      clinicId: row.clinic_id,
      clinicName: row.clinic_name,
      clinicCity: row.clinic_city,
      memberId: row.member_id,
      role: row.role,
      displayName: row.display_name ?? null,
      entitled: row.entitled,
      trialEndsAt: row.trial_ends_at ?? null,
      paidThrough: row.paid_through ?? null,
      ...access,
      db,
    },
  };
});

const RENEWAL_NOTICE_MS = 7 * 24 * 60 * 60 * 1000;

function accessWindow(trialEndsAt: string | null, paidThrough: string | null) {
  const trialEnd = trialEndsAt ? Date.parse(trialEndsAt) : 0;
  const paidEnd = paidThrough ? Date.parse(paidThrough) : 0;
  const end = Math.max(trialEnd, paidEnd);
  if (!end) return { accessEndsAt: null, accessEndsSoon: false, onTrial: false };
  return {
    accessEndsAt: new Date(end).toISOString(),
    accessEndsSoon: end - Date.now() <= RENEWAL_NOTICE_MS,
    onTrial: trialEnd >= paidEnd,
  };
}

/** Returns the member context or throws 401/403. */
export async function getAuthContext(): Promise<AuthContext> {
  const state = await getSessionState();
  switch (state.kind) {
    case "signed_out":
      throw new AppError("unauthenticated");
    case "no_org":
      throw new AppError("no_active_clinic");
    case "no_membership":
      throw new AppError("forbidden");
    case "member":
      return state.ctx;
  }
}

/**
 * The single entry point for authorization in Server Actions, Route Handlers
 * and data loaders. Throws AppError (401/402/403) when the caller may not
 * perform `permission`. PostgreSQL RLS enforces the same rules again.
 */
export async function requirePermission(permission: Permission): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!hasPermission(ctx.role, permission)) throw new AppError("forbidden");
  if (requiresEntitlement(permission) && !ctx.entitled) throw new AppError("entitlement_required");
  return ctx;
}
