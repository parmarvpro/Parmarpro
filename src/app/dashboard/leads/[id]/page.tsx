import { ArrowLeftIcon, Trash2Icon, UserPlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppointmentFormDialog } from "@/components/appointments/appointment-form-dialog";
import { sourceLabel } from "@/components/dashboard/options";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { LeadFormDialog } from "@/components/leads/lead-form-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { describeActivity } from "@/lib/activity";
import { formatDateTime, formatPhone, humanize } from "@/lib/format";
import { isAppError } from "@/server/auth/errors";
import { hasPermission } from "@/server/auth/permissions";
import { convertLeadAction, deleteLeadAction } from "@/server/actions/leads";
import { getLead } from "@/server/dal/leads";
import { memberLabel } from "@/server/dal/shared";
import { listAssignableMembers } from "@/server/dal/team";

export const metadata: Metadata = { title: "Lead" };

async function load(id: string) {
  try {
    return await getLead(id);
  } catch (error) {
    if (isAppError(error) && (error.code === "not_found" || error.code === "invalid_input")) notFound();
    throw error;
  }
}

export default async function LeadPage({ params }: PageProps<"/dashboard/leads/[id]">) {
  const { id } = await params;
  const [{ lead, history, tasks, appointments, role }, members] = await Promise.all([load(id), listAssignableMembers()]);
  const canUpdate = hasPermission(role, "lead:update");
  const canDelete = hasPermission(role, "lead:delete");
  const canBook = hasPermission(role, "appointment:create");
  const canTask = hasPermission(role, "task:create");
  const canConvert = hasPermission(role, "patient:create") && canUpdate && !lead.patient_id;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard/leads">
          <ArrowLeftIcon /> All leads
        </Link>
      </Button>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.full_name}</h1>
            <StatusBadge status={lead.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {sourceLabel(lead.source)} · added {formatDateTime(lead.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate ? <LeadFormDialog members={members} lead={lead} /> : null}
          {canBook ? <AppointmentFormDialog members={members} presetLead={{ id: lead.id, full_name: lead.full_name }} /> : null}
          {canTask ? <TaskFormDialog members={members} compact link={{ leadId: lead.id, label: lead.full_name }} /> : null}
          {canConvert ? (
            <ConfirmActionButton
              label="Create patient record"
              icon={<UserPlusIcon />}
              title="Create a patient record?"
              description="This copies the name, phone and email into a new patient record, links it to this lead and marks the lead converted."
              confirmLabel="Create patient"
              success="Patient record created"
              action={convertLeadAction.bind(null, lead.id)}
            />
          ) : null}
          {canDelete ? (
            <ConfirmActionButton
              label="Delete"
              icon={<Trash2Icon />}
              variant="destructive"
              title="Delete this lead?"
              description="This permanently removes the lead. Leads with appointments can't be deleted; mark them lost instead."
              confirmLabel="Delete lead"
              success="Lead deleted"
              action={deleteLeadAction.bind(null, lead.id)}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{lead.phone_e164 ? <a className="hover:underline" href={`tel:${lead.phone_e164}`}>{formatPhone(lead.phone_e164)}</a> : "—"}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{lead.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Assigned to</dt>
              <dd>{lead.assignee ? memberLabel(lead.assignee) : "Unassigned"}</dd>
              <dt className="text-muted-foreground">Next follow-up</dt>
              <dd>{formatDateTime(lead.next_follow_up_at)}</dd>
              <dt className="text-muted-foreground">Patient record</dt>
              <dd>
                {lead.patient ? (
                  <Link className="text-primary hover:underline" href={`/dashboard/patients/${lead.patient.id}`}>
                    {lead.patient.full_name}
                  </Link>
                ) : (
                  "Not linked"
                )}
              </dd>
              {lead.status === "lost" ? (
                <>
                  <dt className="text-muted-foreground">Lost reason</dt>
                  <dd>{lead.lost_reason ?? "—"}</dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-wrap">{lead.notes ?? "—"}</dd>
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appointments</CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No appointments booked from this inquiry yet.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {appointments.map((appointment) => (
                    <li key={appointment.id} className="flex items-center justify-between py-2">
                      <span>
                        {formatDateTime(appointment.starts_at)} · {humanize(appointment.appointment_type)}
                      </span>
                      <StatusBadge status={appointment.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks linked to this lead.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {tasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-4 py-2">
                      <span className={task.status === "done" ? "text-muted-foreground line-through" : undefined}>{task.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{task.status === "done" ? "Done" : `Due ${formatDateTime(task.due_at)}`}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Follow-up history</CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
              ) : (
                <ol className="space-y-3 border-l pl-4 text-sm">
                  {history.map((event) => (
                    <li key={event.id} className="relative">
                      <span className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-primary" />
                      <p>{describeActivity({ entity_type: "lead", action: event.action, metadata: event.metadata })}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
