import Link from "next/link";

import { Logo } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted-foreground">
            Inquiry follow-up, appointments and team tasks for dental clinics. Built in Mumbai.
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-medium">Product</p>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link href="/features" className="hover:text-foreground">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
            <li><Link href="/contact" className="hover:text-foreground">Contact</Link></li>
          </ul>
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-medium">Legal</p>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link href="/privacy" className="hover:text-foreground">Privacy notice</Link></li>
            <li><Link href="/terms" className="hover:text-foreground">Terms of service</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} ParmarPro. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
