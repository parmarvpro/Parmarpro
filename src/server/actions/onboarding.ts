"use server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { clinicSetupSchema } from "@/lib/validation/clinic";
import { runAction, type ActionResult } from "@/server/actions/result";
import { AppError } from "@/server/auth/errors";
import { throwIfDbError } from "@/server/db/errors";
import { createUserDb } from "@/server/db/user-client";
import { reconcileInvitedMembership } from "@/server/privileged/membership";
import { parseInput } from "@/server/validation";

/**
 * Creates the clinic for the caller's active Clerk organization. The browser
 * has already created the organization and made it active; the database
 * function re-checks that the token's org role is admin and that no clinic
 * exists yet.
 */
export async function completeClinicSetup(input: unknown): Promise<ActionResult<{ clinicId: string }>> {
  return runAction("onboarding.completeClinicSetup", async () => {
    const session = await auth();
    if (!session.userId) throw new AppError("unauthenticated");
    if (!session.orgId) throw new AppError("no_active_clinic");
    if (session.orgRole !== "org:admin") throw new AppError("forbidden");

    const { name, city } = parseInput(clinicSetupSchema, input);
    const user = await currentUser();
    const db = createUserDb(() => session.getToken());
    const { data, error } = await db.rpc("create_clinic_for_active_org", {
      p_name: name,
      p_city: city,
      p_display_name: user?.fullName ?? user?.firstName ?? undefined,
    });
    throwIfDbError(error);
    return { clinicId: data as string };
  });
}

/** Activates an accepted invitation for the caller's active organization. */
export async function claimInvitation(): Promise<ActionResult<{ joined: boolean }>> {
  return runAction("onboarding.claimInvitation", async () => {
    const session = await auth();
    if (!session.userId) throw new AppError("unauthenticated");
    if (!session.orgId) throw new AppError("no_active_clinic");
    const joined = await reconcileInvitedMembership({ userId: session.userId, orgId: session.orgId });
    return { joined };
  });
}
