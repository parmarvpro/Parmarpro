import Link from "next/link";

import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-ink-600">
            Inquiry follow-up, appointments and team tasks for dental clinics. Built in Mumbai.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="eyebrow">Product</p>
          <ul className="space-y-2 text-ink-600">
            <li><Link href="/features" className="hover:text-brand-600">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-brand-600">Pricing</Link></li>
            <li><Link href="/contact" className="hover:text-brand-600">Contact</Link></li>
          </ul>
        </div>
        <div className="space-y-3 text-sm">
          <p className="eyebrow">Legal</p>
          <ul className="space-y-2 text-ink-600">
            <li><Link href="/privacy" className="hover:text-brand-600">Privacy notice</Link></li>
            <li><Link href="/terms" className="hover:text-brand-600">Terms of service</Link></li>
          </ul>
        </div>
      </div>
      <div aria-hidden="true" className="overflow-hidden border-t border-hairline select-none">
        <p className="outline-text-soft text-center text-[clamp(3rem,13.6vw,15rem)] leading-[0.82] font-extrabold tracking-[-0.05em] uppercase">
          ParmarPro
        </p>
      </div>
      <div className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5 text-xs text-ink-500 sm:px-6">
          <p>© {new Date().getFullYear()} ParmarPro. All rights reserved.</p>
          <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
          <p className="eyebrow">For dental clinics in Mumbai</p>
        </div>
      </div>
    </footer>
  );
}
