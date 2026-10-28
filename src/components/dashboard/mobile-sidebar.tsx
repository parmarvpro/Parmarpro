"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";

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
      <SheetContent className="p-4">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <Logo href="/dashboard" />
        <p className="mt-4 truncate px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{clinicName}</p>
        <div className="mt-2">
          <SidebarNav items={items} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
