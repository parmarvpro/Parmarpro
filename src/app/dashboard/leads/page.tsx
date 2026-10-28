import { InboxIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { leadSourceOptions, leadStatusOptions, sourceLabel } from "@/components/dashboard/options";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { LeadFormDialog } from "@/components/leads/lead-form-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, formatPhone } from "@/lib/format";
import { flattenSearchParams } from "@/lib/search-params";
import { getAuthContext } from "@/server/auth/context";
import { hasPermission } from "@/server/auth/permissions";
import { listLeads } from "@/server/dal/leads";
import { memberLabel } from "@/server/dal/shared";
import { listAssignableMembers } from "@/server/dal/team";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/dashboard/leads">) {
  const params = flattenSearchParams(await searchParams);
  const [{ rows, total, filters }, members, ctx] = await Promise.all([listLeads(params), listAssignableMembers(), getAuthContext()]);
  const canCreate = hasPermission(ctx.role, "lead:create");

  return (
    <>
      <PageHeader
        title="Leads & inquiries"
        description="Everyone who has contacted the clinic, with source, status and next follow-up."
        actions={canCreate ? <LeadFormDialog members={members} /> : null}
      />
      <FilterBar
        search={{ placeholder: "Search name or phone" }}
        selects={[
          { name: "status", label: "All statuses", options: leadStatusOptions },
          { name: "source", label: "All sources", options: leadSourceOptions },
          {
            name: "followUp",
            label: "Any follow-up",
            options: [
              { value: "overdue", label: "Follow-up overdue" },
              { value: "today", label: "Follow-up today" },
              { value: "upcoming", label: "Follow-up upcoming" },
            ],
          },
          {
            name: "assignee",
            label: "Anyone",
            options: [{ value: "me", label: "Assigned to me" }, { value: "unassigned", label: "Unassigned" }, ...members.map((m) => ({ value: m.id, label: memberLabel(m) }))],
          },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title={total === 0 && !params.q ? "No leads yet" : "No leads match these filters"}
          description={canCreate ? "Add the next inquiry that comes in by phone, WhatsApp or at the front desk." : "Leads added by your team will appear here."}
          action={canCreate ? <LeadFormDialog members={members} /> : null}
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Next follow-up</TableHead>
                <TableHead>Assigned to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((lead) => {
                const overdue = lead.followUpOverdue;
                return (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/leads/${lead.id}`} className="hover:underline">
                        {lead.full_name}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatPhone(lead.phone_e164)}</TableCell>
                    <TableCell>{sourceLabel(lead.source)}</TableCell>
                    <TableCell>
                      <StatusBadge status={lead.status} />
                    </TableCell>
                    <TableCell className={overdue ? "font-medium whitespace-nowrap text-destructive" : "whitespace-nowrap text-muted-foreground"}>
                      {formatDateTime(lead.next_follow_up_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{lead.assignee ? memberLabel(lead.assignee) : "Unassigned"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={filters.page} total={total} searchParams={params} basePath="/dashboard/leads" />
    </>
  );
}
