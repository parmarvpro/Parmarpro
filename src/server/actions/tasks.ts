"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/actions/result";
import { createTask, deleteTask, setTaskStatus, updateTask } from "@/server/dal/tasks";

export async function createTaskAction(input: unknown) {
  return runAction("tasks.create", async () => {
    const task = await createTask(input);
    revalidatePath("/dashboard", "layout");
    return task;
  });
}

export async function updateTaskAction(id: unknown, input: unknown) {
  return runAction("tasks.update", async () => {
    await updateTask(id, input);
    revalidatePath("/dashboard", "layout");
  });
}

export async function setTaskStatusAction(id: unknown, status: unknown) {
  return runAction("tasks.status", async () => {
    await setTaskStatus(id, status);
    revalidatePath("/dashboard", "layout");
  });
}

export async function deleteTaskAction(id: unknown) {
  return runAction("tasks.delete", async () => {
    await deleteTask(id);
    revalidatePath("/dashboard", "layout");
  });
}
