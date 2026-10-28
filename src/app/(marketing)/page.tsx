import { ArrowRightIcon, LockKeyholeIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";

import { EyebrowTag } from "@/components/brand/eyebrow-tag";
import { Sparkle } from "@/components/brand/sparkle";
import { StepCard } from "@/components/brand/step-card";
import {
  ActivityArt,
  AppointmentsArt,
  DashboardArt,
  LeadsArt,
  RolesArt,
  TasksArt,
} from "@/components/motion/bento-art";
import { CountUp } from "@/components/motion/count-up";
import { CounterFlowStage } from "@/components/motion/counter-flow-stage";
import { DotDrift } from "@/components/motion/dot-drift";
import { IntroCurtain } from "@/components/motion/intro-curtain";
import { IsolationArt } from "@/components/motion/isolation-art";
import { Magnetic } from "@/components/motion/magnetic";
import { MarqueeRibbon } from "@/components/motion/marquee-ribbon";
import { Reveal } from "@/components/motion/reveal";
import { SpotlightTile } from "@/components/motion/spotlight-tile";
import { SplitWords } from "@/components/motion/split-words";
import { StepRow } from "@/components/motion/step-row";
import { Button } from "@/components/ui/button";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";

const TILES = [
  {
    title: "Leads & inquiries",
    body: "A status pipeline from new to converted, with lost reasons and the full follow-up history.",
    art: <LeadsArt />,
    span: "md:col-span-4",
    wide: false,
  },
  {
    title: "Appointments",
    body: "Schedule, reschedule and cancel with a clear status for every visit.",
    art: <AppointmentsArt />,
    span: "md:col-span-2",
    wide: false,
  },
  {
    title: "Follow-up tasks",
    body: "Assignable tasks with due dates and an overdue view for the front desk.",
    art: <TasksArt />,
    span: "md:col-span-2",
    wide: false,
  },
  {
    title: "Dashboard",
    body: "Counts of inquiries, conversions and appointments for any date range, from your own records.",
    art: <DashboardArt />,
    span: "md:col-span-2",
    wide: false,
  },
  {
    title: "Team roles",
    body: "Owner, administrator, staff and read-only access for every clinic.",
    art: <RolesArt />,
    span: "md:col-span-2",
    wide: false,
  },
  {
    title: "Activity history",
    body: "See who changed what and when, without copying personal details into the log.",
    art: <ActivityArt />,
    span: "md:col-span-6",
    wide: true,
  },
];

export default function HomePage() {
  const plan = PLANS.parmarpro_clinic_monthly;
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

      <section className="pt-16 sm:pt-24">
        <MarqueeRibbon />
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
        <Reveal className="max-w-3xl space-y-4">
          <p className="eyebrow">How it works</p>
          <h2 className="headline text-3xl text-brand-500 sm:text-5xl">
            <SplitWords text="From first call to first visit, sorted." accent={["sorted"]} />
          </h2>
        </Reveal>
        <StepRow className="mt-16 grid gap-4 md:grid-cols-3">
          <StepCard number="01" label="Inquiries" word="Capture" flow={0}>
            Log calls, WhatsApp messages, walk-ins and website enquiries in one list, with the source recorded.
          </StepCard>
          <StepCard number="02" label="Reminders" word="Follow up" highlight flow={1}>
            Set the next follow-up date, assign it to a team member and see what is overdue each morning.
          </StepCard>
          <StepCard number="03" label="Appointments" word="Book" flow={2}>
            Turn inquiries into appointments, then reschedule, confirm, cancel or mark outcomes as they happen.
          </StepCard>
        </StepRow>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-32">
        <Reveal className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-4">
            <p className="eyebrow">Product</p>
            <h2 className="headline text-3xl text-brand-500 sm:text-5xl">
              <SplitWords text="Everything the front desk needs" accent={["needs"]} />
            </h2>
            <p className="max-w-2xl text-ink-600">
              Built for how Indian dental clinics actually receive patients: phone, WhatsApp, walk-ins and referrals.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/features">
              See all features <ArrowRightIcon />
            </Link>
          </Button>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-6">
          {TILES.map((tile, index) => (
            <Reveal key={tile.title} className={tile.span} delay={(index % 3) * 80}>
              <SpotlightTile className={`h-full p-6 ${tile.wide ? "md:grid md:grid-cols-[1fr_1.4fr] md:items-center md:gap-8" : ""}`}>
                <div className={tile.wide ? "md:order-2" : undefined}>
                  <div className="rounded-xl bg-brand-50/70 p-3">{tile.art}</div>
                </div>
                <div className={tile.wide ? "md:order-1" : undefined}>
                  <h3 className="mt-5 text-lg font-bold text-ink-900 md:mt-5">{tile.title}</h3>
                  <p className="mt-1.5 max-w-md text-sm text-ink-600">{tile.body}</p>
                </div>
              </SpotlightTile>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-32">
        <Reveal>
          <div className="grid items-center gap-10 rounded-3xl border border-brand-500/30 bg-paper p-8 md:grid-cols-[1fr_1.1fr] md:p-12">
            <div className="space-y-6">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-brand-500 ring-1 ring-brand-200">
                <ShieldCheckIcon className="size-6" />
              </span>
              <h2 className="headline text-3xl text-brand-500 sm:text-4xl">
                <SplitWords text="Clinic data kept separate and minimal" accent={["separate"]} />
              </h2>
              <ul className="space-y-4 text-sm text-ink-700">
                <li className="flex gap-3">
                  <LockKeyholeIcon className="mt-0.5 size-4 shrink-0 text-brand-500" />
                  <span>
                    Each clinic&apos;s records are isolated by access rules enforced in the database itself, not only in the
                    app screens.
                  </span>
                </li>
                <li className="flex gap-3">
                  <LockKeyholeIcon className="mt-0.5 size-4 shrink-0 text-brand-500" />
                  <span>
                    Patient records hold contact details and communication consent only. ParmarPro is not an electronic
                    health record and does not ask for clinical notes.
                  </span>
                </li>
                <li className="flex gap-3">
                  <LockKeyholeIcon className="mt-0.5 size-4 shrink-0 text-brand-500" />
                  <span>Role-based access for owners, administrators, staff and read-only users, with an activity history.</span>
                </li>
              </ul>
            </div>
            <IsolationArt className="mx-auto w-full max-w-md" />
          </div>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <div className="relative overflow-hidden rounded-3xl bg-brand-500">
          <DotDrift
            index={0}
            style={{ "--dot-mask": "linear-gradient(to bottom right, transparent 30%, #000 100%)" } as React.CSSProperties}
            className="opacity-50"
          />
          <Sparkle tone="white" className="spin-slow absolute -right-16 -bottom-20 hidden size-96 opacity-95 md:block" />
          <div className="relative flex flex-col items-start gap-6 p-8 md:p-14">
            <EyebrowTag tone="inverse">{TRIAL_DAYS}-day free trial</EyebrowTag>
            <h2 className="headline max-w-2xl text-3xl text-white sm:text-5xl">
              <SplitWords text={`Try it with your team for ${TRIAL_DAYS} days.`} accent={["days"]} />
            </h2>
            <p className="max-w-lg text-white">Set up takes a few minutes. Invite your front desk when you are ready.</p>
            <p className="text-white">
              After the trial:{" "}
              <span className="text-2xl font-extrabold">
                ₹<CountUp to={plan.basePaise / 100} />
              </span>{" "}
              per clinic per month, plus 18% GST.
            </p>
            <Magnetic>
              <Button asChild size="lg" variant="inverse">
                <Link href="/sign-up">
                  Create your clinic workspace <ArrowRightIcon />
                </Link>
              </Button>
            </Magnetic>
          </div>
        </div>
      </section>
    </>
  );
}
