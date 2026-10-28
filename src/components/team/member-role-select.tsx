"use client";

import { useActionSubmit } from "@/components/forms/use-action-submit";
import { NativeSelect } from "@/components/ui/native-select";
import { humanize } from "@/lib/format";
import { changeMemberRoleAction } from "@/server/actions/team";

export function MemberRoleSelect({ memberId, role, roles, label }: { memberId: string; role: string; roles: readonly string[]; label: string }) {
  const { pending, run } = useActionSubmit({ success: "Role updated" });
  return (
    <NativeSelect
      aria-label={`Role for ${label}`}
      className="h-8 w-32 text-xs"
      value={role}
      disabled={pending}
      onChange={(event) => run(() => changeMemberRoleAction({ memberId, role: event.target.value }))}
    >
      {roles.map((value) => (
        <option key={value} value={value}>
          {humanize(value)}
        </option>
      ))}
    </NativeSelect>
  );
}
