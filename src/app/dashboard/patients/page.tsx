import { CheckIcon, MinusIcon, UsersRoundIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/dashboard/empty-state";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { PageHeader } from "@/components/dashboard/page-header";
import { Pagination } from "@/components/dashboard/pagination";
import { PatientFormDialog } from "@/components/patients/patient-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatPhone } from "@/lib/format";
import { flattenSearchParams } from "@/lib/search-params";
import { getAuthContext } from "@/server/auth/context";
import { hasPermission } from "@/server/auth/permissions";
import { listPatients } from "@/server/dal/patients";

export const metadata: Metadata = { title: "Patients" };

function Consent({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${label}: ${on ? "consented" : "no consent"}`}>
      {on ? <CheckIcon className="size-3.5 text-success" /> : <MinusIcon className="size-3.5" />}
      {label}
    </span>
  );
}

export default async function PatientsPage({ searchParams }: PageProps<"/dashboard/patients">) {
  const params = flattenSearchParams(await searchParams);
  const [{ rows, total, filters }, ctx] = await Promise.all([listPatients(params), getAuthContext()]);
  const canCreate = hasPermission(ctx.role, "patient:create");

  return (
    <>
      <PageHeader eyebrow="Records" title="Patients" description="Contact details and communication preferences." actions={canCreate ? <PatientFormDialog /> : null} />
      <FilterBar
        search={{ placeholder: "Search name or phone" }}
        selects={[{ name: "archived", label: "Active patients", options: [{ value: "include", label: "Active and archived" }, { value: "only", label: "Archived only" }] }]}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={UsersRoundIcon}
          title={total === 0 && !params.q ? "No patients yet" : "No patients match"}
          description="Add patients directly, or create them from a lead when an inquiry converts."
          action={canCreate ? <PatientFormDialog /> : null}
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Consent</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">
                    <Link href={`/dashboard/patients/${patient.id}`} className="hover:underline">
                      {patient.full_name}
                    </Link>
                    {patient.archived_at ? <Badge variant="outline" className="ml-2">Archived</Badge> : null}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatPhone(patient.phone_e164)}</TableCell>
                  <TableCell className="max-w-48 truncate text-muted-foreground">{patient.email ?? "—"}</TableCell>
                  <TableCell>
                    {patient.opted_out_at ? (
                      <Badge variant="warning">Opted out</Badge>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        <Consent on={patient.whatsapp_consent} label="WhatsApp" />
                        <Consent on={patient.sms_consent} label="SMS" />
                        <Consent on={patient.email_consent} label="Email" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(patient.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={filters.page} total={total} searchParams={params} basePath="/dashboard/patients" />
    </>
  );
}
