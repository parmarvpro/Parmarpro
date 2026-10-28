"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/actions/result";
import { createAppointment, deleteAppointment, setAppointmentStatus, updateAppointment } from "@/server/dal/appointments";

export async function createAppointmentAction(input: unknown) {
  return runAction("appointments.create", async () => {
    const result = await createAppointment(input);
    revalidatePath("/dashboard", "layout");
    return result;
  });
}

export async function updateAppointmentAction(id: unknown, input: unknown) {
  return runAction("appointments.update", async () => {
    await updateAppointment(id, input);
    revalidatePath("/dashboard", "layout");
  });
}

export async function setAppointmentStatusAction(id: unknown, input: unknown) {
  return runAction("appointments.status", async () => {
    await setAppointmentStatus(id, input);
    revalidatePath("/dashboard", "layout");
  });
}

export async function deleteAppointmentAction(id: unknown) {
  return runAction("appointments.delete", async () => {
    await deleteAppointment(id);
    revalidatePath("/dashboard", "layout");
  });
}
