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

import { BrowserFrame } from "@/components/brand/browser-frame";
import { EyebrowTag } from "@/components/brand/eyebrow-tag";
import { Halftone } from "@/components/brand/halftone";
import { Sparkle } from "@/components/brand/sparkle";
import { StepCard } from "@/components/brand/step-card";
import { Badge } from "@/components/ui/badge";
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
      <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-white">
          <Halftone map="band" className="absolute inset-0 hidden lg:block" />
          <div className="relative grid items-center gap-10 p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:p-12">
            <div className="space-y-6">
              <EyebrowTag>For dental clinics in Mumbai</EyebrowTag>
              <h1 className="headline text-4xl text-brand-500 sm:text-5xl lg:text-6xl">
                Stop losing patients between the first call and the first visit.
              </h1>
              <p className="max-w-xl text-lg text-ink-700 text-pretty">
                ParmarPro gives your front desk one place to track inquiries, follow-ups, appointments and team tasks,
                so no interested patient is forgotten.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/sign-up">
                    Start your {TRIAL_DAYS}-day trial <ArrowRightIcon />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/contact">Talk to us</Link>
                </Button>
              </div>
              <p className="text-sm text-ink-500">No card required to start the trial.</p>
            </div>
            <BrowserFrame>
              <ProductPreview />
            </BrowserFrame>
          </div>
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

/** Static illustration with clearly labelled sample data; not real clinic metrics. */
function ProductPreview() {
  const rows = [
    { name: "Sample inquiry 1", source: "WhatsApp", status: "Follow-up today" },
    { name: "Sample inquiry 2", source: "Phone call", status: "Appointment booked" },
    { name: "Sample inquiry 3", source: "Walk-in", status: "New" },
  ];
  return (
    <figure className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Leads &amp; inquiries</p>
        <Badge variant="warning">Illustration · sample data</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["Inquiries", "Follow-ups due", "Appointments"].map((label) => (
          <div key={label} className="rounded-xl border bg-linear-to-b from-white to-brand-50 p-3">
            <p className="text-[11px] text-ink-500">{label}</p>
            <div className="mt-2 h-4 w-8 rounded bg-brand-100" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-sm">
            <div>
              <p className="font-medium text-ink-900">{row.name}</p>
              <p className="text-xs text-ink-500">{row.source}</p>
            </div>
            <Badge variant={row.status === "New" ? "default" : "secondary"}>{row.status}</Badge>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">Illustration of the ParmarPro inquiry list using sample data.</figcaption>
    </figure>
  );
}
