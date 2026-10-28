import { CheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatInr, PLANS, priceBreakdown, TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  const plan = PLANS.parmarpro_clinic_monthly;
  const price = priceBreakdown(plan);
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple pricing, one plan</h1>
        <p className="mt-3 text-lg text-muted-foreground">Every feature is included. Pay month by month, with no long-term contract.</p>
      </div>
      <div className="mx-auto mt-12 max-w-lg rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{plan.name}</h2>
          <Badge>{TRIAL_DAYS}-day free trial</Badge>
        </div>
        <p className="mt-6 flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight">{formatInr(price.basePaise)}</span>
          <span className="text-muted-foreground">per clinic / month</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          + 18% GST ({formatInr(price.gstPaise)}). Total {formatInr(price.totalPaise)} per month.
        </p>
        <ul className="mt-6 space-y-3 text-sm">
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-3">
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <Button asChild size="lg" className="mt-8 w-full">
          <Link href="/sign-up">Start free trial</Link>
        </Button>
        <p className="mt-4 text-xs text-muted-foreground">
          After the trial, the clinic owner pays for each month in advance through Razorpay (UPI, cards, net banking).
          Access is extended only after Razorpay confirms the payment. If a month lapses, your records stay readable
          and you can renew at any time.
        </p>
      </div>
    </div>
  );
}
