"use client";

import { useActionSubmit } from "@/components/forms/use-action-submit";
import { Checkbox } from "@/components/ui/checkbox";
import { track } from "@/lib/analytics/client";
import { setTaskStatusAction } from "@/server/actions/tasks";

export function TaskStatusToggle({ id, done, disabled, label }: { id: string; done: boolean; disabled?: boolean; label: string }) {
  const { pending, run } = useActionSubmit({
    success: done ? "Task reopened" : "Task completed",
    onSuccess: () => {
      if (!done) track("task_completed", {});
    },
  });
  return (
    <Checkbox
      checked={done}
      disabled={disabled || pending}
      aria-label={done ? `Reopen task: ${label}` : `Complete task: ${label}`}
      onCheckedChange={() => run(() => setTaskStatusAction(id, done ? "open" : "done"))}
    />
  );
}
