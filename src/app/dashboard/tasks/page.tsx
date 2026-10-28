import { ListChecksIcon, Trash2Icon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { TaskStatusToggle } from "@/components/tasks/task-status-toggle";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { flattenSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { deleteTaskAction } from "@/server/actions/tasks";
import { hasPermission } from "@/server/auth/permissions";
import { memberLabel } from "@/server/dal/shared";
import { listTasks } from "@/server/dal/tasks";
import { listAssignableMembers } from "@/server/dal/team";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: PageProps<"/dashboard/tasks">) {
  const params = flattenSearchParams(await searchParams);
  const [{ rows, total, filters, role }, members] = await Promise.all([listTasks(params), listAssignableMembers()]);
  const canCreate = hasPermission(role, "task:create");
  const canUpdate = hasPermission(role, "task:update");
  const canDelete = hasPermission(role, "task:delete");

  return (
    <>
      <PageHeader eyebrow="Follow-ups" title="Follow-up tasks" description="What the team needs to do next, and what is overdue." actions={canCreate ? <TaskFormDialog members={members} /> : null} />
      <FilterBar
        selects={[
          {
            name: "view",
            label: "Open tasks",
            options: [
              { value: "overdue", label: "Overdue" },
              { value: "today", label: "Due today" },
              { value: "done", label: "Completed" },
              { value: "all", label: "All tasks" },
            ],
          },
          { name: "assignee", label: "Anyone", options: [{ value: "me", label: "Assigned to me" }, ...members.map((m) => ({ value: m.id, label: memberLabel(m) }))] },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={ListChecksIcon}
          title={filters.view === "overdue" ? "Nothing overdue" : "No tasks in this view"}
          description="Create follow-up tasks for call-backs, confirmations and reminders."
          action={canCreate ? <TaskFormDialog members={members} /> : null}
        />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((task) => {
            const done = task.status === "done";
            const overdue = task.isOverdue;
            return (
              <li key={task.id} className="flex items-start gap-3 px-4 py-3">
                <div className="pt-0.5">
                  <TaskStatusToggle id={task.id} done={done} disabled={!canUpdate || task.status === "cancelled"} label={task.title} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium", done && "text-muted-foreground line-through")}>{task.title}</p>
                  {task.description ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{task.description}</p> : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className={overdue ? "font-medium text-destructive" : undefined}>
                      {done ? `Completed ${formatDateTime(task.completed_at)}` : `Due ${formatDateTime(task.due_at)}`}
                    </span>
                    <span>{task.assignee ? memberLabel(task.assignee) : "Unassigned"}</span>
                    {task.lead ? (
                      <Link href={`/dashboard/leads/${task.lead.id}`} className="hover:underline">
                        Lead: {task.lead.full_name}
                      </Link>
                    ) : null}
                    {task.patient ? (
                      <Link href={`/dashboard/patients/${task.patient.id}`} className="hover:underline">
                        Patient: {task.patient.full_name}
                      </Link>
                    ) : null}
                    {task.status === "cancelled" ? <Badge variant="outline">Cancelled</Badge> : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {canUpdate && !done ? (
                    <TaskFormDialog
                      members={members}
                      task={{ ...task, lead_id: task.lead?.id ?? null, patient_id: task.patient?.id ?? null }}
                    />
                  ) : null}
                  {canDelete ? (
                    <ConfirmActionButton
                      label="Delete task"
                      size="icon"
                      variant="ghost"
                      icon={<Trash2Icon />}
                      title="Delete this task?"
                      description="This permanently removes the task."
                      confirmLabel="Delete"
                      success="Task deleted"
                      action={deleteTaskAction.bind(null, task.id)}
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={filters.page} total={total} searchParams={params} basePath="/dashboard/tasks" />
    </>
  );
}
