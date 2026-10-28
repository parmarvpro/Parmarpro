import { MailIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";

import { ContactForm } from "@/components/marketing/contact-form";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.3fr]">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Talk to us</h1>
        <p className="text-lg text-muted-foreground">
          Questions about ParmarPro, a walkthrough for your team, or help getting set up. Leave your details and we will
          reply.
        </p>
        <ul className="space-y-3 pt-4 text-sm text-muted-foreground">
          <li className="flex items-center gap-3">
            <MapPinIcon className="size-4 text-primary" /> Mumbai, Maharashtra, India
          </li>
          <li className="flex items-center gap-3">
            <MailIcon className="size-4 text-primary" /> Replies within one working day
          </li>
        </ul>
      </div>
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <ContactForm />
      </div>
    </div>
  );
}
