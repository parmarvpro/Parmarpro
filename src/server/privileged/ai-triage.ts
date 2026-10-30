import "server-only";

import { triageRow, type Triage } from "@/lib/ai-triage";
import { privilegedDb } from "@/server/privileged/client";

/**
 * PRIVILEGED: stores the AI triage of a website enquiry. The visitor is anonymous, so there is
 * no signed-in user to check. The clinic is passed explicitly, and the composite foreign key
 * (clinic_id, lead_id) refuses a lead that is not in that clinic.
 */
export async function saveLeadTriageAsService(clinicId: string, leadId: string, triage: Triage, model: string): Promise<void> {
  const { error } = await privilegedDb()
    .from("lead_ai_triage")
    .upsert({ clinic_id: clinicId, lead_id: leadId, ...triageRow(triage, model) }, { onConflict: "lead_id" });
  if (error) throw error;
}
