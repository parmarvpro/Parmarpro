import Link from "next/link";

import { Halftone } from "@/components/brand/halftone";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-brand-500/30 bg-white">
        <Halftone map="radial" className="absolute inset-0" />
        <div className="relative flex flex-col items-center gap-5 px-6 py-20 text-center">
          <Logo />
          <p className="headline text-7xl text-brand-500 sm:text-8xl" aria-hidden="true">404</p>
          <h1 className="text-2xl font-bold text-ink-900">Page not found</h1>
          <p className="text-ink-600">The page you&apos;re looking for doesn&apos;t exist.</p>
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
