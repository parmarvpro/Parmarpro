import { ArrowRightIcon, CheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EyebrowTag } from "@/components/brand/eyebrow-tag";
import { Halftone } from "@/components/brand/halftone";
import { Sparkle } from "@/components/brand/sparkle";
import { PageHero } from "@/components/marketing/page-hero";
import { Tilt } from "@/components/motion/tilt";
import { Button } from "@/components/ui/button";
import { formatInr, PLANS, priceBreakdown, TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  const plan = PLANS.parmarpro_clinic_monthly;
  const price = priceBreakdown(plan);
  return (
    <>
      <PageHero eyebrow="Pricing" title="Simple pricing, one plan" accent={["plan"]}>
        Every feature is included. Pay month by month, with no long-term contract.
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Tilt className="overflow-hidden rounded-3xl"><div className="grid overflow-hidden rounded-3xl border border-brand-500/30 bg-white md:grid-cols-[1fr_1.15fr]">
          <div className="relative overflow-hidden bg-brand-500 p-8 text-white md:p-10">
            <Halftone map="corner" inverse className="absolute inset-0" />
            <Sparkle tone="white" className="absolute -right-8 -bottom-10 hidden size-56 md:block" />
            <div className="relative space-y-6">
              <EyebrowTag tone="inverse">{TRIAL_DAYS}-day free trial</EyebrowTag>
              <h2 className="headline text-3xl sm:text-4xl">{plan.name}</h2>
              <div>
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-5xl font-extrabold tracking-tight tabular-nums">{formatInr(price.basePaise)}</span>
                  <span>per clinic / month</span>
                </p>
                <p className="mt-2 text-sm">
                  + 18% GST ({formatInr(price.gstPaise)}). Total {formatInr(price.totalPaise)} per month.
                </p>
              </div>
            </div>
          </div>
          <div className="p-8 md:p-10">
            <p className="eyebrow">Everything included</p>
            <ul className="mt-5 space-y-3 text-sm text-ink-700">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <CheckIcon className="size-3.5" />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-8 w-full sm:w-auto">
              <Link href="/sign-up">
                Start free trial <ArrowRightIcon />
              </Link>
            </Button>
            <p className="mt-6 text-xs leading-relaxed text-ink-500">
              After the trial, the clinic owner pays for each month in advance through Razorpay (UPI, cards, net banking).
              Access is extended only after Razorpay confirms the payment. If a month lapses, your records stay readable and
              you can renew at any time.
            </p>
          </div>
        </div></Tilt>
      </div>
    </>
  );
}
