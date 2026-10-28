"use client";

import {
  CalendarIcon,
  CreditCardIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  SettingsIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavItem } from "@/components/dashboard/nav-items";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboardIcon,
  inbox: InboxIcon,
  "users-round": UsersRoundIcon,
  calendar: CalendarIcon,
  "list-checks": ListChecksIcon,
  users: UsersIcon,
  settings: SettingsIcon,
  "credit-card": CreditCardIcon,
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/settings") return pathname === "/dashboard/settings";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="flex flex-col gap-0.5">
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboardIcon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-ink-50 hover:text-ink-900",
              active &&
                "bg-sidebar-accent font-semibold text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-500 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
