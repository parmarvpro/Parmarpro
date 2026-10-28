import { Show } from "@clerk/nextjs";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { MobileMarketingNav } from "@/components/marketing/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export const MARKETING_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            {MARKETING_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Show when="signed-out">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/sign-up">Start free trial</Link>
            </Button>
          </Show>
          <Show when="signed-in">
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          </Show>
          <MobileMarketingNav />
        </div>
      </div>
    </header>
  );
}
