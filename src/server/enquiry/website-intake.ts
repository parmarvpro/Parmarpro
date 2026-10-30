import "server-only";

import { paidLaneConfigured } from "@/server/ai/configured";
import { type EnquirySortInput, type EnquirySortResult, sortEnquiry } from "@/server/ai/features/enquiry-sort";
import { scheduleAfter } from "@/server/automations/schedule";
import { saveLeadTriageAsService } from "@/server/privileged/ai-triage";
import { createWebsiteLead, findEnquiryClinic, type EnquiryClinic, websiteEnquiriesToday } from "@/server/privileged/enquiry";

/**
 * Stores one website enquiry as a lead and, when the clinic has AI help on, sorts it after the
 * visitor has their response. The steps are injected so the whole path can be tested against
 * the real database with a fake sorter. Nothing here waits on the AI, and a sort failure never
 * changes the result the visitor sees.
 */

/** Website enquiries per clinic per IST day. Stops a flood from filling the leads list. */
export const WEBSITE_DAILY_CAP = 50;

export type WebsiteEnquiry = {
  fullName: string;
  phone: string | null;
  email: string | null;
  message: string | null;
};

export type WebsiteIntakeOutcome = "sent" | "unavailable" | "busy";

export type WebsiteIntakeDeps = {
  findEnquiryClinic: typeof findEnquiryClinic;
  websiteEnquiriesToday: typeof websiteEnquiriesToday;
  createWebsiteLead: typeof createWebsiteLead;
  sortEnquiry: (input: EnquirySortInput) => Promise<EnquirySortResult | null>;
  saveLeadTriageAsService: typeof saveLeadTriageAsService;
  paidLaneConfigured: () => boolean;
  schedule: (task: () => Promise<void>) => void;
};

export const productionWebsiteIntakeDeps: WebsiteIntakeDeps = {
  findEnquiryClinic,
  websiteEnquiriesToday,
  createWebsiteLead,
  sortEnquiry,
  saveLeadTriageAsService,
  paidLaneConfigured,
  schedule: scheduleAfter,
};

/**
 * Stores the enquiry for the clinic the key names. The result never says more than "unavailable":
 * a wrong key and a switched-off form look the same to the visitor.
 */
export async function storeWebsiteEnquiry(
  key: string,
  enquiry: WebsiteEnquiry,
  deps: WebsiteIntakeDeps = productionWebsiteIntakeDeps,
): Promise<WebsiteIntakeOutcome> {
  const clinic = await deps.findEnquiryClinic(key);
  if (!clinic) return "unavailable";
  if ((await deps.websiteEnquiriesToday(clinic.clinicId)) >= WEBSITE_DAILY_CAP) return "busy";

  const leadId = await deps.createWebsiteLead({
    clinicId: clinic.clinicId,
    fullName: enquiry.fullName,
    phone: enquiry.phone,
    email: enquiry.email,
    message: enquiry.message,
  });
  scheduleSort(clinic, leadId, enquiry, deps);
  return "sent";
}

/**
 * Queues the sort of the visitor's own message, and only when the clinic has AI help on, there is
 * a message to read, and the paid key is configured. The result is saved as the service, since the
 * visitor has no signed-in user.
 */
function scheduleSort(clinic: EnquiryClinic, leadId: string, enquiry: WebsiteEnquiry, deps: WebsiteIntakeDeps): void {
  if (!clinic.aiEnquiryHelp || enquiry.message === null || !deps.paidLaneConfigured()) return;
  const message = enquiry.message;
  deps.schedule(async () => {
    const result = await deps.sortEnquiry({
      text: message,
      source: "website",
      clinicName: clinic.clinicName,
      contact: { fullName: enquiry.fullName, phone: enquiry.phone, email: enquiry.email },
      clinicId: clinic.clinicId,
    });
    if (result) await deps.saveLeadTriageAsService(clinic.clinicId, leadId, result.triage, result.model);
  });
}
