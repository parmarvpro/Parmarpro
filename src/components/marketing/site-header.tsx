import { Show } from "@clerk/nextjs";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { MobileMarketingNav } from "@/components/marketing/mobile-nav";
import { Button } from "@/components/ui/button";

export const MARKETING_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 text-sm font-medium text-ink-600 md:flex">
            {MARKETING_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-3 py-1.5 transition-colors hover:bg-brand-50 hover:text-brand-700"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Show when="signed-out">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </Show>
          <Show when="signed-in">
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          </Show>
          <MobileMarketingNav />
        </div>
      </div>
    </header>
  );
}
