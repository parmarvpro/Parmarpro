import type { Metadata } from "next";
import Link from "next/link";

import { ClinicSettingsForm } from "@/components/dashboard/clinic-settings-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { hasPermission } from "@/server/auth/permissions";
import { getClinic } from "@/server/dal/clinic";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { clinic, role } = await getClinic();
  return (
    <>
      <PageHeader title="Settings" description="Clinic details and workspace preferences." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clinic details</CardTitle>
            <CardDescription>Shown to your team. Workspace created {formatDate(clinic.created_at)}.</CardDescription>
          </CardHeader>
          <CardContent>
            <ClinicSettingsForm name={clinic.name} city={clinic.city} disabled={!hasPermission(role, "clinic:update")} />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Time zone</CardTitle>
              <CardDescription>All dates and times are shown and entered in India Standard Time (Asia/Kolkata).</CardDescription>
            </CardHeader>
          </Card>
          {hasPermission(role, "billing:read") ? (
            <Card>
              <CardHeader>
                <CardTitle>Billing</CardTitle>
                <CardDescription>Plan status, payments and history.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href="/dashboard/settings/billing">Open billing</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Your account</CardTitle>
              <CardDescription>Manage your name, email, password and two-step verification from the account menu (top right).</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </>
  );
}
