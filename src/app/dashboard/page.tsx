import { ArrowRightIcon, BellRingIcon, CalendarCheck2Icon, CheckCircle2Icon, InboxIcon, TrendingUpIcon, UsersRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterBar } from "@/components/dashboard/filter-bar";
import { sourceLabel } from "@/components/dashboard/options";
import { PageHeader } from "@/components/dashboard/page-header";
import { Stat } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeActivity } from "@/lib/activity";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { flattenSearchParams } from "@/lib/search-params";
import { getDashboard } from "@/server/dal/dashboard";
import { memberLabel } from "@/server/dal/shared";

export const metadata: Metadata = { title: "Overview" };

const RANGE_LABEL: Record<string, string> = { "7d": "last 7 days", "30d": "last 30 days", "90d": "last 90 days", month: "this month" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const params = flattenSearchParams(await searchParams);
  const data = await getDashboard(params);
  const { summary } = data;
  const rangeLabel = RANGE_LABEL[data.range] ?? "selected period";

  return (
    <>
      <PageHeader eyebrow="Overview" title={data.clinicName} description="An overview built from your clinic's own records." />
      <FilterBar
        selects={[
          {
            name: "range",
            label: "Last 30 days",
            options: [
              { value: "7d", label: "Last 7 days" },
              { value: "90d", label: "Last 90 days" },
              { value: "month", label: "This month" },
            ],
          },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="New inquiries" value={summary.leads_created} hint={rangeLabel} icon={InboxIcon} href="/dashboard/leads" />
        <Stat label="Converted inquiries" value={summary.leads_converted} hint={`marked converted, ${rangeLabel}`} icon={TrendingUpIcon} href="/dashboard/leads?status=converted" />
        <Stat label="Appointments" value={summary.appointments_in_range} hint={`scheduled in ${rangeLabel}`} icon={CalendarCheck2Icon} href="/dashboard/appointments?range=all" />
        <Stat label="Tasks completed" value={summary.tasks_completed} hint={rangeLabel} icon={CheckCircle2Icon} href="/dashboard/tasks?view=done" />
        <Stat label="Follow-ups due" value={summary.follow_ups_due} hint="inquiries past their follow-up date" icon={BellRingIcon} href="/dashboard/leads?followUp=overdue" />
        <Stat label="Overdue tasks" value={summary.tasks_overdue} hint="open and past due" icon={BellRingIcon} href="/dashboard/tasks?view=overdue" />
        <Stat label="Active patients" value={summary.patients_total} hint="not archived" icon={UsersRoundIcon} href="/dashboard/patients" />
        <Card className="h-full">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Inquiries by status</p>
            {Object.keys(summary.leads_by_status).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No inquiries in this period.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {Object.entries(summary.leads_by_status).map(([status, count]) => (
                  <li key={status} className="flex justify-between">
                    <span>{humanize(status)}</span>
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming appointments</CardTitle>
              <CardDescription>Scheduled and confirmed</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/appointments">
                All <ArrowRightIcon />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.upcoming.map((appointment) => (
                  <li key={appointment.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{appointment.patient?.full_name ?? appointment.lead?.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(appointment.starts_at)} · {humanize(appointment.appointment_type)}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Overdue tasks</CardTitle>
              <CardDescription>Open tasks past their due time</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/tasks?view=overdue">
                All <ArrowRightIcon />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing overdue. Nice work.</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.overdue.map((task) => (
                  <li key={task.id} className="py-2">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-destructive">
                      Due {formatDateTime(task.due_at)} · <span className="text-muted-foreground">{task.assignee ? memberLabel(task.assignee) : "Unassigned"}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent inquiries</CardTitle>
              <CardDescription>Latest five</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/leads">
                All <ArrowRightIcon />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No inquiries yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {data.recentLeads.map((lead) => (
                  <li key={lead.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <Link href={`/dashboard/leads/${lead.id}`} className="truncate font-medium hover:underline">
                        {lead.full_name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {sourceLabel(lead.source)} · {formatDate(lead.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Changes made by your team</CardDescription>
        </CardHeader>
        <CardContent>
          {data.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.activity.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-4 py-2">
                  <span>{describeActivity(event)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(event.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
