"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/actions/result";
import { draftLeadReply, sortLeadWithAi } from "@/server/dal/ai-triage";
import { convertLeadToPatient, createLead, deleteLead, updateLead } from "@/server/dal/leads";

export async function createLeadAction(input: unknown) {
  return runAction("leads.create", async () => {
    const lead = await createLead(input);
    revalidatePath("/dashboard", "layout");
    return lead;
  });
}

export async function updateLeadAction(id: unknown, input: unknown) {
  return runAction("leads.update", async () => {
    await updateLead(id, input);
    revalidatePath("/dashboard", "layout");
  });
}

export async function deleteLeadAction(id: unknown) {
  return runAction("leads.delete", async () => {
    await deleteLead(id);
    revalidatePath("/dashboard", "layout");
  });
}

export async function convertLeadAction(id: unknown) {
  return runAction("leads.convert", async () => {
    const result = await convertLeadToPatient(id);
    revalidatePath("/dashboard", "layout");
    return result;
  });
}

export async function sortLeadWithAiAction(id: unknown) {
  return runAction("leads.sortWithAi", async () => {
    await sortLeadWithAi(id);
    revalidatePath("/dashboard", "layout");
  });
}

/** A suggested reply to an enquiry. Nothing is stored, so nothing is revalidated. */
export async function draftLeadReplyAction(id: unknown) {
  return runAction("leads.draftReply", () => draftLeadReply(id));
}
