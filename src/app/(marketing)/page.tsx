import {
  ArrowRightIcon,
  CalendarCheck2Icon,
  ClipboardListIcon,
  InboxIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";

import { EyebrowTag } from "@/components/brand/eyebrow-tag";
import { Halftone } from "@/components/brand/halftone";
import { Sparkle } from "@/components/brand/sparkle";
import { StepCard } from "@/components/brand/step-card";
import { CounterFlowStage } from "@/components/motion/counter-flow-stage";
import { IntroCurtain } from "@/components/motion/intro-curtain";
import { SplitWords } from "@/components/motion/split-words";
import { Button } from "@/components/ui/button";
import { TRIAL_DAYS } from "@/lib/plans";

const FEATURES = [
  { title: "Leads & inquiries", body: "Status pipeline from new to converted, with lost reasons and history.", icon: InboxIcon },
  { title: "Appointments", body: "Schedule, reschedule and cancel with a clear status for every visit.", icon: CalendarCheck2Icon },
  { title: "Follow-up tasks", body: "Assignable tasks with due dates and an overdue view for the front desk.", icon: ClipboardListIcon },
  { title: "Team roles", body: "Owner, administrator, staff and read-only access for every clinic.", icon: UsersIcon },
];

export default function HomePage() {
  return (
    <>
      <IntroCurtain />
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="glow-blob pointer-events-none absolute -top-32 left-[4%] -z-10 size-[34rem] bg-[radial-gradient(closest-side,rgb(142_173_255/0.45),transparent)]"
        />
        <div
          aria-hidden="true"
          className="glow-blob pointer-events-none absolute top-24 -right-24 -z-10 size-[30rem] bg-[radial-gradient(closest-side,rgb(186_205_255/0.55),transparent)] [animation-delay:-9s]"
        />
        <div className="mx-auto max-w-6xl px-4 pt-12 text-center sm:px-6 sm:pt-16">
          <EyebrowTag>For dental clinics in Mumbai</EyebrowTag>
          <h1 className="headline mx-auto mt-6 max-w-6xl text-[clamp(2.3rem,5.6vw,5rem)] text-brand-500 [--base:450ms]">
            <SplitWords text="Stop losing patients between the first call and the first visit." accent={["patients"]} />
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-ink-700 text-pretty sm:text-xl">
            ParmarPro gives your front desk one place to track inquiries, follow-ups, appointments and team tasks, so no
            interested patient is forgotten.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/sign-up">
                Start your {TRIAL_DAYS}-day trial <ArrowRightIcon />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/contact">Talk to us</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-ink-500">No card required to start the trial.</p>
        </div>
        <div className="mx-auto mt-10 max-w-6xl px-4 pb-4 sm:mt-12 sm:px-6">
          <CounterFlowStage />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <div className="max-w-3xl space-y-4">
          <p className="eyebrow">How it works</p>
          <h2 className="headline text-3xl text-brand-500 sm:text-5xl">From first call to first visit, sorted.</h2>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <StepCard number="01" label="Inquiries" word="Capture">
            Log calls, WhatsApp messages, walk-ins and website enquiries in one list, with the source recorded.
          </StepCard>
          <StepCard number="02" label="Reminders" word="Follow up" highlight>
            Set the next follow-up date, assign it to a team member and see what is overdue each morning.
          </StepCard>
          <StepCard number="03" label="Appointments" word="Book">
            Turn inquiries into appointments, then reschedule, confirm, cancel or mark outcomes as they happen.
          </StepCard>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-4">
            <p className="eyebrow">Product</p>
            <h2 className="headline text-3xl text-brand-500 sm:text-4xl">Everything the front desk needs</h2>
            <p className="max-w-2xl text-ink-600">
              Built for how Indian dental clinics actually receive patients: phone, WhatsApp, walk-ins and referrals.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/features">
              See all features <ArrowRightIcon />
            </Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border bg-white p-5 transition-colors hover:border-brand-300">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-white">
                <feature.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold text-ink-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-ink-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
        <div className="grid gap-8 rounded-3xl border border-brand-500/30 bg-paper p-8 md:grid-cols-[1fr_1.2fr] md:p-10">
          <div className="space-y-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-brand-500 ring-1 ring-brand-200">
              <ShieldCheckIcon className="size-6" />
            </span>
            <h2 className="headline text-2xl text-brand-500 sm:text-3xl">Clinic data kept separate and minimal</h2>
          </div>
          <ul className="space-y-4 text-sm text-ink-700">
            <li className="flex gap-3">
              <LockKeyholeIcon className="mt-0.5 size-4 shrink-0 text-brand-500" />
              <span>
                Each clinic&apos;s records are isolated by access rules enforced in the database itself, not only in the app
                screens.
              </span>
            </li>
            <li className="flex gap-3">
              <LockKeyholeIcon className="mt-0.5 size-4 shrink-0 text-brand-500" />
              <span>
                Patient records hold contact details and communication consent only. ParmarPro is not an electronic health
                record and does not ask for clinical notes.
              </span>
            </li>
            <li className="flex gap-3">
              <LockKeyholeIcon className="mt-0.5 size-4 shrink-0 text-brand-500" />
              <span>Role-based access for owners, administrators, staff and read-only users, with an activity history.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand-500">
          <Halftone map="corner" inverse className="absolute inset-0" />
          <Sparkle tone="white" className="absolute -right-10 -bottom-16 hidden size-80 md:block" />
          <div className="relative flex flex-col items-start gap-6 p-8 md:p-12">
            <EyebrowTag tone="inverse">{TRIAL_DAYS}-day free trial</EyebrowTag>
            <h2 className="headline max-w-2xl text-3xl text-white sm:text-5xl">Try it with your team for {TRIAL_DAYS} days.</h2>
            <p className="max-w-lg text-white">Set up takes a few minutes. Invite your front desk when you are ready.</p>
            <Button asChild size="lg" variant="inverse">
              <Link href="/sign-up">
                Create your clinic workspace <ArrowRightIcon />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
