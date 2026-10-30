import type { Permission } from "@/server/auth/permissions";

export type NavItem = { href: string; label: string; icon: string; permission: Permission };

/** Display-only navigation. Each page re-checks permissions on the server. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "layout-dashboard", permission: "dashboard:read" },
  { href: "/dashboard/leads", label: "Leads", icon: "inbox", permission: "lead:read" },
  { href: "/dashboard/patients", label: "Patients", icon: "users-round", permission: "patient:read" },
  { href: "/dashboard/appointments", label: "Appointments", icon: "calendar", permission: "appointment:read" },
  { href: "/dashboard/tasks", label: "Tasks", icon: "list-checks", permission: "task:read" },
  { href: "/dashboard/team", label: "Team", icon: "users", permission: "team:read" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings", permission: "clinic:read" },
  { href: "/dashboard/settings/automations", label: "Automations", icon: "zap", permission: "clinic:read" },
  { href: "/dashboard/settings/ai", label: "AI help", icon: "sparkles", permission: "clinic:read" },
];
