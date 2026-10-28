import {
  ArrowRightIcon,
  BellRingIcon,
  CalendarCheck2Icon,
  ClipboardListIcon,
  InboxIcon,
  LockKeyholeIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TRIAL_DAYS } from "@/lib/plans";

const STEPS = [
  {
    title: "Capture every inquiry",
    body: "Log calls, WhatsApp messages, walk-ins and website enquiries in one list, with the source recorded.",
    icon: InboxIcon,
  },
  {
    title: "Follow up on time",
    body: "Set the next follow-up date, assign it to a team member and see what is overdue each morning.",
    icon: BellRingIcon,
  },
  {
    title: "Book and track visits",
    body: "Turn inquiries into appointments, then reschedule, confirm, cancel or mark outcomes as they happen.",
    icon: CalendarCheck2Icon,
  },
];

const FEATURES = [
  { title: "Leads & inquiries", body: "Status pipeline from new to converted, with lost reasons and history.", icon: InboxIcon },
  { title: "Appointments", body: "Schedule, reschedule and cancel with a clear status for every visit.", icon: CalendarCheck2Icon },
  { title: "Follow-up tasks", body: "Assignable tasks with due dates and an overdue view for the front desk.", icon: ClipboardListIcon },
  { title: "Team roles", body: "Owner, administrator, staff and read-only access for every clinic.", icon: UsersIcon },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.05fr_1fr]">
          <div className="space-y-6">
            <Badge variant="secondary" className="px-3 py-1">For dental clinics in Mumbai</Badge>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Stop losing patients between the first call and the first visit.
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground text-pretty">
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
            <p className="text-sm text-muted-foreground">No card required to start the trial.</p>
          </div>
          <ProductPreview />
        </div>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="rounded-xl border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <step.icon className="size-5" />
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">Step {index + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Everything the front desk needs</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Built for how Indian dental clinics actually receive patients: phone, WhatsApp, walk-ins and referrals.
            </p>
          </div>
          <Button asChild variant="link" className="px-0">
            <Link href="/features">
              See all features <ArrowRightIcon />
            </Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border bg-card p-5">
              <feature.icon className="size-5 text-primary" />
              <h3 className="mt-3 font-medium">{feature.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid gap-8 rounded-2xl border bg-card p-8 md:grid-cols-[1fr_1.2fr] md:p-10">
          <div className="space-y-3">
            <ShieldCheckIcon className="size-8 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">Designed to keep clinic data separate and minimal</h2>
          </div>
          <ul className="space-y-4 text-sm">
            <li className="flex gap-3">
              <LockKeyholeIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                Each clinic&apos;s records are isolated by access rules enforced in the database itself, not only in the app
                screens.
              </span>
            </li>
            <li className="flex gap-3">
              <LockKeyholeIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>
                Patient records hold contact details and communication consent only. ParmarPro is not an electronic health
                record and does not ask for clinical notes.
              </span>
            </li>
            <li className="flex gap-3">
              <LockKeyholeIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>Role-based access for owners, administrators, staff and read-only users, with an activity history.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="border-t bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Try it with your team for {TRIAL_DAYS} days.</h2>
            <p className="mt-1 text-primary-foreground/80">Set up takes a few minutes. Invite your front desk when you are ready.</p>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/sign-up">Create your clinic workspace</Link>
          </Button>
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
    <figure className="relative rounded-2xl border bg-card p-4 shadow-xl shadow-primary/5">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </div>
        <Badge variant="warning">Illustration · sample data</Badge>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {["Inquiries", "Follow-ups due", "Appointments"].map((label) => (
          <div key={label} className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="mt-2 h-5 w-10 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2.5 text-sm">
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.source}</p>
            </div>
            <Badge variant="secondary">{row.status}</Badge>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">Illustration of the ParmarPro inquiry list using sample data.</figcaption>
    </figure>
  );
}
