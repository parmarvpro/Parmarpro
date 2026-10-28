"use client";

import { Loader2Icon, MailPlusIcon } from "lucide-react";
import { useState } from "react";

import { Field } from "@/components/forms/field";
import { formValues, useActionSubmit } from "@/components/forms/use-action-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { track } from "@/lib/analytics/client";
import { humanize } from "@/lib/format";
import { inviteSchema } from "@/lib/validation/entities";
import { inviteMemberAction } from "@/server/actions/team";

const ROLE_HELP: Record<string, string> = {
  admin: "Runs clinic operations and manages staff. Cannot pay or manage owners.",
  staff: "Adds and updates leads, patients, appointments and tasks.",
  viewer: "Read-only access.",
};

export function InviteDialog({ roles }: { roles: readonly string[] }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(roles.includes("staff") ? "staff" : (roles[0] ?? "viewer"));
  const { pending, run, fieldErrors, setFieldErrors } = useActionSubmit<unknown>({
    success: "Invitation sent",
    onSuccess: (data) => {
      const invited = (data as { role?: string } | undefined)?.role;
      if (invited === "admin" || invited === "staff" || invited === "viewer") track("team_member_invited", { role: invited });
      setOpen(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MailPlusIcon /> Invite member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>They will receive an email to join your clinic. Access starts once they accept.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const values = formValues(event.currentTarget);
            const parsed = inviteSchema.safeParse(values);
            if (!parsed.success) {
              setFieldErrors(parsed.error.flatten().fieldErrors);
              return;
            }
            run(() => inviteMemberAction(values));
          }}
        >
          <Field label="Email" htmlFor="email" error={fieldErrors.email}>
            <Input id="email" name="email" type="email" required autoComplete="off" aria-invalid={Boolean(fieldErrors.email)} />
          </Field>
          <Field label="Role" htmlFor="role" error={fieldErrors.role} hint={ROLE_HELP[role]}>
            <NativeSelect id="role" name="role" value={role} onChange={(event) => setRole(event.target.value)}>
              {roles.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
