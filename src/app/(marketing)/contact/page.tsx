import { MailIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";

import { ContactForm } from "@/components/marketing/contact-form";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = { title: "Contact" };

const PROCESS = [
  { title: "Talk", body: "Tell us how your front desk handles inquiries today." },
  { title: "Set up", body: "Create your clinic workspace and invite your team." },
  { title: "Go live", body: "Start logging inquiries and follow-ups the same day." },
];

export default function ContactPage() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Talk to us">
        Questions about ParmarPro, a walkthrough for your team, or help getting set up. Leave your details and we will reply.
      </PageHero>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.3fr]">
        <div className="space-y-8">
          <div>
            <p className="eyebrow">How we get you started</p>
            <ol className="mt-4 grid gap-2 sm:grid-cols-3 md:grid-cols-1 lg:grid-cols-3">
              {PROCESS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex flex-col gap-3 rounded-2xl bg-linear-to-b from-brand-500 to-brand-700 p-4 text-white"
                >
                  <span className="flex size-7 items-center justify-center rounded-full border border-white/70 text-xs font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <span className="headline text-lg">{step.title}</span>
                  <span className="text-xs leading-relaxed">{step.body}</span>
                </li>
              ))}
            </ol>
          </div>
          <ul className="space-y-3 text-sm text-ink-600">
            <li className="flex items-center gap-3">
              <MapPinIcon className="size-4 text-brand-500" /> Mumbai, Maharashtra, India
            </li>
            <li className="flex items-center gap-3">
              <MailIcon className="size-4 text-brand-500" /> Replies within one working day
            </li>
          </ul>
        </div>
        <div className="rounded-3xl border border-brand-500/30 bg-white p-6 sm:p-8">
          <ContactForm />
        </div>
      </div>
    </>
  );
}
