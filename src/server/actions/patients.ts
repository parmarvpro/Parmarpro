"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/actions/result";
import { createPatient, setPatientArchived, updatePatient } from "@/server/dal/patients";

export async function createPatientAction(input: unknown) {
  return runAction("patients.create", async () => {
    const patient = await createPatient(input);
    revalidatePath("/dashboard", "layout");
    return patient;
  });
}

export async function updatePatientAction(id: unknown, input: unknown) {
  return runAction("patients.update", async () => {
    await updatePatient(id, input);
    revalidatePath("/dashboard", "layout");
  });
}

export async function setPatientArchivedAction(id: unknown, archived: unknown) {
  return runAction("patients.archive", async () => {
    await setPatientArchived(id, archived === true);
    revalidatePath("/dashboard", "layout");
  });
}
