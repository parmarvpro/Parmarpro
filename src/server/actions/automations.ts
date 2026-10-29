"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/actions/result";
import { regenerateEnquiryFormKey, setMyDigestOptOut, updateAutomationSettings } from "@/server/dal/automations";

const SETTINGS_PATH = "/dashboard/settings/automations";

export async function updateAutomationSettingsAction(input: unknown) {
  return runAction("automations.update", async () => {
    await updateAutomationSettings(input);
    revalidatePath(SETTINGS_PATH);
  });
}

export async function regenerateEnquiryFormKeyAction() {
  return runAction("automations.regenerateKey", async () => {
    await regenerateEnquiryFormKey();
    revalidatePath(SETTINGS_PATH);
  });
}

export async function setMyDigestOptOutAction(optOut: unknown) {
  return runAction("automations.digestOptOut", async () => {
    await setMyDigestOptOut(optOut);
    revalidatePath(SETTINGS_PATH);
  });
}
