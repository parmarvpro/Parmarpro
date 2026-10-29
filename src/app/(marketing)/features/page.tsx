import {
  ActivityIcon,
  BarChart3Icon,
  CalendarCheck2Icon,
  ClipboardListIcon,
  InboxIcon,
  ShieldCheckIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHero } from "@/components/marketing/page-hero";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Features" };

const SECTIONS = [
  {
    icon: InboxIcon,
    title: "Leads and inquiries",
    points: [
      "Record the source: phone call, WhatsApp, walk-in, website, Google, Instagram, Facebook, referral, Practo, Justdial or other",
      "Move inquiries through new, contacted, qualified, appointment booked, converted or lost",
      "Assign an owner and a next follow-up date; search and filter the list",
      "See the follow-up history of every inquiry",
    ],
  },
  {
    icon: UserRoundIcon,
    title: "Patient contact records",
    points: [
      "Name, phone and email, kept to what the front desk needs",
      "Record WhatsApp, SMS and email consent, plus opt-outs",
      "No clinical notes, diagnoses or prescriptions: ParmarPro is not an EHR",
    ],
  },
  {
    icon: CalendarCheck2Icon,
    title: "Appointments",
    points: [
      "Book for a patient or directly from an inquiry",
      "Confirm, reschedule, cancel, or mark as completed or no-show",
      "Filter by date, status and team member",
    ],
  },
  {
    icon: ClipboardListIcon,
    title: "Follow-up tasks",
    points: ["Create and assign tasks with due dates", "Overdue view for the daily huddle", "Link tasks to an inquiry, patient or appointment"],
  },
  {
    icon: BarChart3Icon,
    title: "Dashboard",
    points: [
      "Counts of new inquiries, conversions, appointments and completed tasks for any date range",
      "Every number is calculated from your clinic's own records",
    ],
  },
  {
    icon: UsersIcon,
    title: "Team and roles",
    points: [
      "Invite your team by email",
      "Owner, administrator, staff and read-only roles",
      "Administrators manage staff; only the owner manages billing",
    ],
  },
  {
    icon: ActivityIcon,
    title: "Activity history",
    points: ["See who changed what and when, without copying personal details into the log"],
  },
  {
    icon: ShieldCheckIcon,
    title: "Security by design",
    points: [
      "Clinic data isolated by database-level access rules",
      "Sign-in powered by Clerk, with multi-factor authentication available",
      "Payments handled by Razorpay; ParmarPro never sees card details",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <PageHero eyebrow="Product" title="Features">
        Everything ParmarPro does today. We list only features that exist in the product.
      </PageHero>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          {SECTIONS.map((section, index) => (
            <section key={section.title} className="h-full rounded-2xl border bg-white p-6 transition-colors hover:border-brand-300">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500 text-white">
                    <section.icon className="size-5" />
                  </span>
                  <h2 className="text-lg font-semibold text-ink-900">{section.title}</h2>
                </div>
                <span className="text-2xl font-bold tracking-tight text-brand-200 tabular-nums" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink-600 marker:text-brand-500">
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/sign-up">Start free trial</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">See pricing</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
