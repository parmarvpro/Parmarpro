import { ArchiveIcon, ArchiveRestoreIcon, ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppointmentFormDialog } from "@/components/appointments/appointment-form-dialog";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { PatientFormDialog } from "@/components/patients/patient-form-dialog";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime, formatPhone, humanize } from "@/lib/format";
import { setPatientArchivedAction } from "@/server/actions/patients";
import { isAppError } from "@/server/auth/errors";
import { hasPermission } from "@/server/auth/permissions";
import { getPatient } from "@/server/dal/patients";
import { listAssignableMembers } from "@/server/dal/team";

export const metadata: Metadata = { title: "Patient" };

async function load(id: string) {
  try {
    return await getPatient(id);
  } catch (error) {
    if (isAppError(error) && (error.code === "not_found" || error.code === "invalid_input")) notFound();
    throw error;
  }
}

export default async function PatientPage({ params }: PageProps<"/dashboard/patients/[id]">) {
  const { id } = await params;
  const [{ patient, appointments, leads, tasks, role }, members] = await Promise.all([load(id), listAssignableMembers()]);
  const archived = Boolean(patient.archived_at);

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/dashboard/patients">
          <ArrowLeftIcon /> All patients
        </Link>
      </Button>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{patient.full_name}</h1>
            {archived ? <Badge variant="outline">Archived</Badge> : null}
            {patient.opted_out_at ? <Badge variant="warning">Opted out</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Patient since {formatDate(patient.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission(role, "patient:update") ? <PatientFormDialog patient={patient} /> : null}
          {hasPermission(role, "appointment:create") && !archived ? (
            <AppointmentFormDialog members={members} presetPatient={{ id: patient.id, full_name: patient.full_name }} />
          ) : null}
          {hasPermission(role, "task:create") ? <TaskFormDialog members={members} compact link={{ patientId: patient.id, label: patient.full_name }} /> : null}
          {hasPermission(role, "patient:archive") ? (
            <ConfirmActionButton
              label={archived ? "Restore" : "Archive"}
              icon={archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
              title={archived ? "Restore this patient?" : "Archive this patient?"}
              description={archived ? "The patient will appear in lists and pickers again." : "Archived patients are hidden from lists and pickers. Their history is kept."}
              confirmLabel={archived ? "Restore" : "Archive"}
              success={archived ? "Patient restored" : "Patient archived"}
              action={setPatientArchivedAction.bind(null, patient.id, !archived)}
            />
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>{patient.phone_e164 ? <a className="hover:underline" href={`tel:${patient.phone_e164}`}>{formatPhone(patient.phone_e164)}</a> : "—"}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{patient.email ?? "—"}</dd>
              <dt className="text-muted-foreground">WhatsApp</dt>
              <dd>{patient.whatsapp_consent ? "Consented" : "No consent recorded"}</dd>
              <dt className="text-muted-foreground">SMS</dt>
              <dd>{patient.sms_consent ? "Consented" : "No consent recorded"}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{patient.email_consent ? "Consented" : "No consent recorded"}</dd>
              <dt className="text-muted-foreground">Consent recorded</dt>
              <dd>{formatDateTime(patient.consent_recorded_at)}</dd>
              <dt className="text-muted-foreground">Opted out</dt>
              <dd>{patient.opted_out_at ? formatDateTime(patient.opted_out_at) : "No"}</dd>
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
                <p className="text-sm text-muted-foreground">No appointments yet.</p>
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
              <CardTitle>Inquiries</CardTitle>
            </CardHeader>
            <CardContent>
              {leads.length === 0 ? (
                <p className="text-sm text-muted-foreground">No linked inquiries.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {leads.map((lead) => (
                    <li key={lead.id} className="flex items-center justify-between py-2">
                      <Link href={`/dashboard/leads/${lead.id}`} className="hover:underline">
                        {formatDate(lead.created_at)} · {humanize(lead.source)}
                      </Link>
                      <StatusBadge status={lead.status} />
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
                <p className="text-sm text-muted-foreground">No tasks linked to this patient.</p>
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
        </div>
      </div>
    </div>
  );
}
