"use client";

import { CalendarPlusIcon, Loader2Icon, PencilIcon } from "lucide-react";
import { useState } from "react";

import { appointmentTypeOptions, memberLabel, type MemberOption } from "@/components/dashboard/options";
import { Field } from "@/components/forms/field";
import { formValues, useActionSubmit } from "@/components/forms/use-action-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics/client";
import { isoToIstLocal } from "@/lib/validation/common";
import { appointmentCreateSchema, appointmentUpdateSchema } from "@/lib/validation/entities";
import { createAppointmentAction, updateAppointmentAction } from "@/server/actions/appointments";

type Option = { id: string; full_name: string };

export type AppointmentFormValues = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  appointment_type: string;
  assigned_to: string | null;
  notes: string | null;
};

export function AppointmentFormDialog({
  members,
  patients = [],
  presetPatient,
  presetLead,
  appointment,
  triggerLabel,
}: {
  members: MemberOption[];
  patients?: Option[];
  presetPatient?: Option;
  presetLead?: Option;
  appointment?: AppointmentFormValues;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const editing = Boolean(appointment);
  const { pending, run, fieldErrors, setFieldErrors } = useActionSubmit<unknown>({
    success: editing ? "Appointment updated" : "Appointment booked",
    onSuccess: (data) => {
      if (!editing && data && typeof data === "object" && "appointmentType" in data) {
        const result = data as { appointmentType: "consultation" | "follow_up" | "procedure" | "other"; fromLead: boolean };
        track("appointment_created", { appointment_type: result.appointmentType, from_lead: result.fromLead });
      }
      setOpen(false);
    },
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event.currentTarget);
    const schema = editing ? appointmentUpdateSchema : appointmentCreateSchema;
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    run(() => (appointment ? updateAppointmentAction(appointment.id, values) : createAppointmentAction(values)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline" size="sm">
            <PencilIcon /> Reschedule / edit
          </Button>
        ) : (
          <Button variant={presetLead || presetPatient ? "outline" : "default"} size={presetLead || presetPatient ? "sm" : "default"}>
            <CalendarPlusIcon /> {triggerLabel ?? "Book appointment"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Reschedule or edit appointment" : "Book appointment"}</DialogTitle>
          <DialogDescription>
            {presetLead ? `For inquiry: ${presetLead.full_name}` : presetPatient ? `For patient: ${presetPatient.full_name}` : "Times are in India Standard Time."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          {!editing ? (
            presetLead ? (
              <input type="hidden" name="leadId" value={presetLead.id} />
            ) : presetPatient ? (
              <input type="hidden" name="patientId" value={presetPatient.id} />
            ) : (
              <Field label="Patient" htmlFor="patientId" error={fieldErrors.patientId} className="sm:col-span-2">
                <NativeSelect id="patientId" name="patientId" defaultValue="" aria-invalid={Boolean(fieldErrors.patientId)}>
                  <option value="">Select a patient</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )
          ) : null}
          <Field label="Date and time" htmlFor="startsAt" error={fieldErrors.startsAt}>
            <Input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={isoToIstLocal(appointment?.starts_at)} aria-invalid={Boolean(fieldErrors.startsAt)} />
          </Field>
          <Field label="Duration (minutes)" htmlFor="durationMinutes" error={fieldErrors.durationMinutes}>
            <Input id="durationMinutes" name="durationMinutes" type="number" min={5} max={480} step={5} defaultValue={appointment?.duration_minutes ?? 30} />
          </Field>
          <Field label="Type" htmlFor="appointmentType" error={fieldErrors.appointmentType}>
            <NativeSelect id="appointmentType" name="appointmentType" defaultValue={appointment?.appointment_type ?? "consultation"}>
              {appointmentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="With" htmlFor="assignedTo" error={fieldErrors.assignedTo}>
            <NativeSelect id="assignedTo" name="assignedTo" defaultValue={appointment?.assigned_to ?? ""}>
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {memberLabel(member)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Notes" htmlFor="notes" error={fieldErrors.notes} hint="Scheduling notes only. No clinical details." className="sm:col-span-2">
            <Textarea id="notes" name="notes" rows={2} maxLength={1000} defaultValue={appointment?.notes ?? ""} />
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {editing ? "Save" : "Book"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
