import { ArrowRightIcon, LockKeyholeIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";

import { EyebrowTag } from "@/components/brand/eyebrow-tag";
import { Sparkle } from "@/components/brand/sparkle";
import { AccentWords } from "@/components/brand/accent-words";
import { StepCard } from "@/components/brand/step-card";
import { Button } from "@/components/ui/button";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";

const TILES = [
  {
    title: "Leads & inquiries",
    body: "A status pipeline from new to converted, with lost reasons and the full follow-up history.",
    span: "md:col-span-4",
  },
  {
    title: "Appointments",
    body: "Schedule, reschedule and cancel with a clear status for every visit.",
    span: "md:col-span-2",
  },
  {
    title: "Follow-up tasks",
    body: "Assignable tasks with due dates and an overdue view for the front desk.",
    span: "md:col-span-2",
  },
  {
    title: "Dashboard",
    body: "Counts of inquiries, conversions and appointments for any date range, from your own records.",
    span: "md:col-span-2",
  },
  {
    title: "Team roles",
    body: "Owner, administrator, staff and read-only access for every clinic.",
    span: "md:col-span-2",
  },
  {
    title: "Activity history",
    body: "See who changed what and when, without copying personal details into the log.",
    span: "md:col-span-6",
  },
];

export default function HomePage() {
  const plan = PLANS.parmarpro_clinic_monthly;
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-[4%] -z-10 size-[34rem] bg-[radial-gradient(closest-side,rgb(142_173_255/0.45),transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-24 -right-24 -z-10 size-[30rem] bg-[radial-gradient(closest-side,rgb(186_205_255/0.55),transparent)]"
        />
        <div className="mx-auto max-w-6xl px-4 pt-12 text-center sm:px-6 sm:pt-16">
          <EyebrowTag>For dental clinics in Mumbai</EyebrowTag>
          <h1 className="headline mx-auto mt-6 max-w-6xl text-[clamp(1.9rem,6.1vw+0.2rem,4.5rem)] text-brand-500 [--base:450ms]">
            <AccentWords text="Stop losing patients between the first call and the first visit." accent={["patients"]} />
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
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-28">
        <div className="max-w-3xl space-y-4">
          <p className="eyebrow">How it works</p>
          <h2 className="headline text-[clamp(1.6rem,3.4vw,3rem)] text-brand-500">
            <AccentWords text="From first call to first visit, sorted." accent={["sorted"]} />
          </h2>
        </div>
        <div className="mt-16 grid gap-4 md:grid-cols-3">
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

      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-32">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-4">
            <p className="eyebrow">Product</p>
            <h2 className="headline text-[clamp(1.6rem,3.4vw,3rem)] text-brand-500">
              <AccentWords text="Everything the front desk needs" accent={["needs"]} />
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
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-6">
          {TILES.map((tile) => (
            <div key={tile.title} className={tile.span}>
              <div className="h-full rounded-2xl border bg-white p-6">
                <h3 className="text-lg font-bold text-ink-900">{tile.title}</h3>
                <p className="mt-1.5 max-w-md text-sm text-ink-600">{tile.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6 sm:pt-32">
        <div>
          <div className="rounded-3xl border border-brand-500/30 bg-paper p-8 md:p-12">
            <div className="space-y-6">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-brand-500 ring-1 ring-brand-200">
                <ShieldCheckIcon className="size-6" />
              </span>
              <h2 className="headline text-[clamp(1.6rem,3.4vw,3rem)] text-brand-500">
                <AccentWords text="Clinic data kept separate and minimal" accent={["separate"]} />
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
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <div className="relative overflow-hidden rounded-3xl bg-brand-500">
          <Sparkle tone="white" className="absolute -right-16 -bottom-20 hidden size-96 opacity-95 md:block" />
          <div className="relative flex flex-col items-start gap-6 p-8 md:p-14">
            <EyebrowTag tone="inverse">{TRIAL_DAYS}-day free trial</EyebrowTag>
            <h2 className="headline max-w-2xl text-[clamp(1.6rem,3.4vw,3rem)] text-white">
              <AccentWords text={`Try it with your team for ${TRIAL_DAYS} days.`} accent={["days"]} />
            </h2>
            <p className="max-w-lg text-white">Set up takes a few minutes. Invite your front desk when you are ready.</p>
            <p className="text-white">
              After the trial:{" "}
              <span className="text-2xl font-bold">
                ₹{(plan.basePaise / 100).toLocaleString("en-IN")}
              </span>{" "}
              per clinic per month, plus 18% GST.
            </p>
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
