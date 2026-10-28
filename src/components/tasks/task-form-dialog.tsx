"use client";

import { ListPlusIcon, Loader2Icon, PencilIcon } from "lucide-react";
import { useState } from "react";

import { memberLabel, type MemberOption } from "@/components/dashboard/options";
import { Field } from "@/components/forms/field";
import { formValues, useActionSubmit } from "@/components/forms/use-action-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { isoToIstLocal } from "@/lib/validation/common";
import { taskInputSchema } from "@/lib/validation/entities";
import { createTaskAction, updateTaskAction } from "@/server/actions/tasks";

export type TaskFormValues = {
  id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  assigned_to: string | null;
  lead_id?: string | null;
  patient_id?: string | null;
  appointment_id?: string | null;
};

export function TaskFormDialog({
  members,
  task,
  link,
  compact,
}: {
  members: MemberOption[];
  task?: TaskFormValues;
  /** Pre-link a new task to a lead, patient or appointment. */
  link?: { leadId?: string; patientId?: string; appointmentId?: string; label: string };
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run, fieldErrors, setFieldErrors } = useActionSubmit({
    success: task ? "Task updated" : "Task added",
    onSuccess: () => setOpen(false),
  });

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formValues(event.currentTarget);
    const parsed = taskInputSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    run(() => (task ? updateTaskAction(task.id, values) : createTaskAction(values)));
  }

  const leadId = task ? task.lead_id : link?.leadId;
  const patientId = task ? task.patient_id : link?.patientId;
  const appointmentId = task ? task.appointment_id : link?.appointmentId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {task ? (
          <Button variant="ghost" size="icon" aria-label="Edit task">
            <PencilIcon />
          </Button>
        ) : (
          <Button variant={compact ? "outline" : "default"} size={compact ? "sm" : "default"}>
            <ListPlusIcon /> Add task
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Add follow-up task"}</DialogTitle>
          <DialogDescription>{link ? `Linked to ${link.label}` : "Assign it and set a due date so it shows up in the overdue view."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {leadId ? <input type="hidden" name="leadId" value={leadId} /> : null}
          {patientId ? <input type="hidden" name="patientId" value={patientId} /> : null}
          {appointmentId ? <input type="hidden" name="appointmentId" value={appointmentId} /> : null}
          <Field label="Task" htmlFor="title" error={fieldErrors.title}>
            <Input id="title" name="title" required maxLength={200} defaultValue={task?.title} placeholder="e.g. Call back about treatment estimate" aria-invalid={Boolean(fieldErrors.title)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Due" htmlFor="dueAt" error={fieldErrors.dueAt} hint="India Standard Time">
              <Input id="dueAt" name="dueAt" type="datetime-local" defaultValue={isoToIstLocal(task?.due_at)} />
            </Field>
            <Field label="Assigned to" htmlFor="assignedTo" error={fieldErrors.assignedTo}>
              <NativeSelect id="assignedTo" name="assignedTo" defaultValue={task?.assigned_to ?? ""}>
                <option value="">Unassigned</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {memberLabel(member)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="Details" htmlFor="description" error={fieldErrors.description} hint="No clinical details.">
            <Textarea id="description" name="description" rows={3} maxLength={2000} defaultValue={task?.description ?? ""} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {task ? "Save" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
