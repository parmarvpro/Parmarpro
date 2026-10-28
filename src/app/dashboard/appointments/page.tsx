import { CalendarIcon, Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AppointmentFormDialog } from "@/components/appointments/appointment-form-dialog";
import { AppointmentStatusMenu } from "@/components/appointments/appointment-status-menu";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { appointmentStatusOptions } from "@/components/dashboard/options";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatPhone, formatTime, humanize } from "@/lib/format";
import { flattenSearchParams } from "@/lib/search-params";
import { deleteAppointmentAction } from "@/server/actions/appointments";
import { hasPermission } from "@/server/auth/permissions";
import { listAppointments } from "@/server/dal/appointments";
import { listPatientOptions } from "@/server/dal/patients";
import { memberLabel } from "@/server/dal/shared";
import { listAssignableMembers } from "@/server/dal/team";

export const metadata: Metadata = { title: "Appointments" };

export default async function AppointmentsPage({ searchParams }: PageProps<"/dashboard/appointments">) {
  const params = flattenSearchParams(await searchParams);
  const [{ rows, total, filters, role }, members] = await Promise.all([listAppointments(params), listAssignableMembers()]);
  const canCreate = hasPermission(role, "appointment:create");
  const canUpdate = hasPermission(role, "appointment:update");
  const canDelete = hasPermission(role, "appointment:delete");
  const patients = canCreate ? await listPatientOptions() : [];

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Times shown in India Standard Time."
        actions={canCreate ? <AppointmentFormDialog members={members} patients={patients} /> : null}
      />
      <FilterBar
        selects={[
          {
            name: "range",
            label: "Upcoming",
            options: [
              { value: "today", label: "Today" },
              { value: "past", label: "Past" },
              { value: "all", label: "All dates" },
            ],
          },
          { name: "status", label: "All statuses", options: appointmentStatusOptions },
          { name: "assignee", label: "Anyone", options: [{ value: "me", label: "With me" }, ...members.map((m) => ({ value: m.id, label: memberLabel(m) }))] },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarIcon}
          title="No appointments in this view"
          description={canCreate ? "Book an appointment for a patient here, or from a lead when an inquiry is ready to visit." : "Appointments booked by your team will appear here."}
          action={canCreate ? <AppointmentFormDialog members={members} patients={patients} /> : null}
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>With</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((appointment) => {
                const person = appointment.patient ?? appointment.lead;
                const href = appointment.patient ? `/dashboard/patients/${appointment.patient.id}` : appointment.lead ? `/dashboard/leads/${appointment.lead.id}` : null;
                const open = appointment.status === "scheduled" || appointment.status === "confirmed";
                return (
                  <TableRow key={appointment.id}>
                    <TableCell className="whitespace-nowrap">
                      <p className="font-medium">{formatDate(appointment.starts_at)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(appointment.starts_at)} · {appointment.duration_minutes} min
                      </p>
                    </TableCell>
                    <TableCell>
                      {person && href ? (
                        <Link href={href} className="font-medium hover:underline">
                          {person.full_name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      <p className="text-xs text-muted-foreground">
                        {appointment.patient ? "Patient" : "Inquiry"} · {formatPhone(person?.phone_e164)}
                      </p>
                    </TableCell>
                    <TableCell>{humanize(appointment.appointment_type)}</TableCell>
                    <TableCell className="text-muted-foreground">{appointment.assignee ? memberLabel(appointment.assignee) : "Unassigned"}</TableCell>
                    <TableCell>
                      <StatusBadge status={appointment.status} />
                      {appointment.cancel_reason ? <p className="mt-1 max-w-40 truncate text-xs text-muted-foreground">{appointment.cancel_reason}</p> : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {canUpdate && open ? (
                          <>
                            <AppointmentFormDialog members={members} appointment={appointment} />
                            <AppointmentStatusMenu id={appointment.id} status={appointment.status} />
                          </>
                        ) : null}
                        {canDelete ? (
                          <ConfirmActionButton
                            label="Delete appointment"
                            size="icon"
                            variant="ghost"
                            icon={<Trash2Icon />}
                            title="Delete this appointment?"
                            description="This permanently removes the appointment. To keep a record, cancel it instead."
                            confirmLabel="Delete"
                            success="Appointment deleted"
                            action={deleteAppointmentAction.bind(null, appointment.id)}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={filters.page} total={total} searchParams={params} basePath="/dashboard/appointments" />
    </>
  );
}
