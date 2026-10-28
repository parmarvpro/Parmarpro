"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";

import { AnalyticsToggle } from "@/components/dashboard/analytics-toggle";
import type { NavItem } from "@/components/dashboard/nav-items";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MobileSidebar({ items, clinicName }: { items: NavItem[]; clinicName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-white p-4">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Logo href="/dashboard" />
        <p className="eyebrow mt-4 truncate px-3 text-ink-500">{clinicName}</p>
        <div className="mt-2 flex-1">
          <SidebarNav items={items} onNavigate={() => setOpen(false)} />
        </div>
        <div className="border-t border-hairline pt-3">
          <AnalyticsToggle />
        </div>
      </SheetContent>
    </Sheet>
  );
}
