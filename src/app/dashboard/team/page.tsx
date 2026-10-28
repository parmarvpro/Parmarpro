import { MailIcon, UserMinusIcon, XIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import { InviteDialog } from "@/components/team/invite-dialog";
import { MemberRoleSelect } from "@/components/team/member-role-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, humanize } from "@/lib/format";
import { removeMemberAction, revokeInvitationAction } from "@/server/actions/team";
import { hasPermission } from "@/server/auth/permissions";
import { memberLabel } from "@/server/dal/shared";
import { listTeam } from "@/server/dal/team";

export const metadata: Metadata = { title: "Team" };

const ROLE_SUMMARY = [
  { role: "Owner", text: "Everything, including billing and managing administrators." },
  { role: "Administrator", text: "Clinic operations and staff management. No billing payments." },
  { role: "Staff", text: "Add and update leads, patients, appointments and tasks." },
  { role: "Read-only", text: "View records without making changes." },
];

export default async function TeamPage() {
  const { members, invitations, me, assignable } = await listTeam();
  const canInvite = hasPermission(me.role, "team:invite");
  const canChange = hasPermission(me.role, "team:change_role");
  const canRemove = hasPermission(me.role, "team:remove");

  return (
    <>
      <PageHeader eyebrow="Clinic" title="Team" description="Who can access this clinic, and what they can do." actions={canInvite ? <InviteDialog roles={assignable} /> : null} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isMe = member.clerk_user_id === me.userId;
                  const manageable = !isMe && assignable.includes(member.role as never);
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {memberLabel(member)} {isMe ? <Badge variant="secondary" className="ml-1">You</Badge> : null}
                      </TableCell>
                      <TableCell>
                        {canChange && manageable ? (
                          <MemberRoleSelect memberId={member.id} role={member.role} roles={assignable} label={memberLabel(member)} />
                        ) : (
                          <Badge variant={member.role === "owner" ? "default" : "secondary"}>{humanize(member.role)}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(member.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {canRemove && manageable ? (
                          <ConfirmActionButton
                            label="Remove"
                            icon={<UserMinusIcon />}
                            variant="ghost"
                            title={`Remove ${memberLabel(member)}?`}
                            description="Their access to this clinic ends immediately. Records they created are kept."
                            confirmLabel="Remove member"
                            success="Member removed"
                            action={removeMemberAction.bind(null, member.id)}
                          />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {canInvite ? (
            <Card>
              <CardHeader>
                <CardTitle>Pending invitations</CardTitle>
                <CardDescription>Invitations expire after 30 days.</CardDescription>
              </CardHeader>
              <CardContent>
                {invitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pending invitations.</p>
                ) : (
                  <ul className="divide-y text-sm">
                    {invitations.map((invitation) => (
                      <li key={invitation.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <MailIcon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{invitation.email}</span>
                          <Badge variant="secondary">{humanize(invitation.role)}</Badge>
                        </span>
                        {assignable.includes(invitation.role as never) ? (
                          <ConfirmActionButton
                            label="Revoke"
                            icon={<XIcon />}
                            variant="ghost"
                            title="Revoke this invitation?"
                            description="The invitation link will stop working."
                            confirmLabel="Revoke"
                            success="Invitation revoked"
                            action={revokeInvitationAction.bind(null, invitation.id)}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {ROLE_SUMMARY.map((item) => (
                <div key={item.role}>
                  <dt className="font-medium">{item.role}</dt>
                  <dd className="text-muted-foreground">{item.text}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
