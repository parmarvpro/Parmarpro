import { AlertTriangleIcon, CheckCircle2Icon, ClockIcon, ReceiptIcon } from "lucide-react";
import type { Metadata } from "next";

import { BillingViewed } from "@/components/billing/billing-viewed";
import { PayButton } from "@/components/billing/pay-button";
import { NoAccess } from "@/components/dashboard/no-access";
import { PageHeader } from "@/components/dashboard/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { formatInr, PLANS, priceBreakdown } from "@/lib/plans";
import { hasPermission } from "@/server/auth/permissions";
import { getBilling } from "@/server/dal/billing";
import { loadUnlessForbidden } from "@/server/page-guards";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const result = await loadUnlessForbidden(getBilling);
  if (!result.allowed) return <NoAccess what="billing" />;
  const billing = result.data;
  const plan = PLANS.parmarpro_clinic_monthly;
  const price = priceBreakdown(plan);
  const canPay = hasPermission(billing.role, "billing:pay");

  return (
    <>
      <BillingViewed />
      <PageHeader eyebrow="Workspace" title="Billing" description="Your plan, access period and payment history." />
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {plan.name}
              {billing.entitled ? (
                <Badge variant={billing.onTrial ? "secondary" : "success"}>{billing.onTrial ? "Free trial" : "Active"}</Badge>
              ) : (
                <Badge variant="destructive">Not active</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {billing.accessEndsAt
                ? `${billing.entitled ? "Access until" : "Access ended on"} ${formatDate(billing.accessEndsAt)}`
                : "No active period"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-brand-200 bg-linear-to-b from-brand-50 to-white p-4 text-sm">
              <div className="flex justify-between">
                <span>Plan (1 month)</span>
                <span className="tabular-nums">{formatInr(price.basePaise)}</span>
              </div>
              <div className="mt-1 flex justify-between text-muted-foreground">
                <span>GST (18%)</span>
                <span className="tabular-nums">{formatInr(price.gstPaise)}</span>
              </div>
              <div className="mt-3 flex justify-between border-t border-brand-200 pt-3 font-semibold text-brand-800">
                <span>Total per month</span>
                <span className="tabular-nums">{formatInr(price.totalPaise)}</span>
              </div>
            </div>
            {!billing.paymentsConfigured ? (
              <Alert variant="warning">
                <AlertTriangleIcon />
                <div>
                  <AlertTitle>Online payments are not configured yet</AlertTitle>
                  <AlertDescription>Razorpay credentials have not been added for this environment.</AlertDescription>
                </div>
              </Alert>
            ) : canPay ? (
              <div className="space-y-2">
                <PayButton label={billing.entitled && !billing.onTrial ? "Pay for next month" : "Pay and activate"} />
                <p className="text-xs text-muted-foreground">
                  Paying adds one month after your current access ends. Payment is processed by Razorpay; ParmarPro never sees card or UPI details.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Only the clinic owner can make payments.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>How billing works</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <ClockIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                Each payment covers one month. There are no automatic debits; you choose when to pay.
              </li>
              <li className="flex gap-3">
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                Access is extended only after Razorpay confirms the payment to our servers.
              </li>
              <li className="flex gap-3">
                <ReceiptIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                If access lapses, your records stay readable and you can renew at any time.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
          <CardDescription>Razorpay payment references for your records.</CardDescription>
        </CardHeader>
        <CardContent>
          {billing.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billing.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(payment.captured_at ?? payment.created_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{payment.provider_payment_id}</TableCell>
                    <TableCell>{payment.method ? humanize(payment.method) : "—"}</TableCell>
                    <TableCell className="tabular-nums">{formatInr(payment.amount_paise)}</TableCell>
                    <TableCell>
                      <Badge variant={payment.status === "captured" ? "success" : payment.status === "failed" ? "destructive" : "secondary"}>
                        {payment.status === "captured" ? "Paid" : humanize(payment.status)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
