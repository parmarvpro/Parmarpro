import type { Metadata } from "next";

import { AutomationSettingsForm, MyEmailsCard } from "@/components/dashboard/automation-settings-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { publicEnv } from "@/lib/env";
import { paidLaneConfigured } from "@/server/ai/configured";
import { hasPermission } from "@/server/auth/permissions";
import { getAutomationSettings, getMyDigestOptOut } from "@/server/dal/automations";

export const metadata: Metadata = { title: "Automations" };

export default async function AutomationsPage() {
  const [{ settings, role }, digestOptOut] = await Promise.all([getAutomationSettings(), getMyDigestOptOut()]);
  const canUpdate = hasPermission(role, "clinic:update");
  const enquiryLink = settings.enquiry_form_key ? `${publicEnv.NEXT_PUBLIC_APP_URL}/enquire/${settings.enquiry_form_key}` : null;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Automations"
        description="Reminders, tasks and emails that ParmarPro sends or creates for your clinic. Times are in India Standard Time."
      />
      <div className="space-y-6">
        <AutomationSettingsForm settings={settings} enquiryLink={enquiryLink} canUpdate={canUpdate} aiAvailable={paidLaneConfigured()} />
        <div className="max-w-2xl">
          <MyEmailsCard digestOptOut={digestOptOut} />
        </div>
      </div>
    </>
  );
}
