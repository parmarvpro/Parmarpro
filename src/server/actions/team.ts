"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/actions/result";
import { updateClinic } from "@/server/dal/clinic";
import { changeMemberRole, inviteMember, removeMember, revokeInvitation } from "@/server/dal/team";

export async function inviteMemberAction(input: unknown) {
  return runAction("team.invite", async () => {
    const result = await inviteMember(input);
    revalidatePath("/dashboard/team");
    return result;
  });
}

export async function revokeInvitationAction(id: unknown) {
  return runAction("team.revokeInvitation", async () => {
    await revokeInvitation(id);
    revalidatePath("/dashboard/team");
  });
}

export async function changeMemberRoleAction(input: unknown) {
  return runAction("team.changeRole", async () => {
    await changeMemberRole(input);
    revalidatePath("/dashboard/team");
  });
}

export async function removeMemberAction(id: unknown) {
  return runAction("team.remove", async () => {
    await removeMember(id);
    revalidatePath("/dashboard/team");
  });
}

export async function updateClinicAction(input: unknown) {
  return runAction("clinic.update", async () => {
    await updateClinic(input);
    revalidatePath("/dashboard", "layout");
  });
}
