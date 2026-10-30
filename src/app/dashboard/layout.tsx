import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import { AnalyticsToggle } from "@/components/dashboard/analytics-toggle";
import { MobileSidebar } from "@/components/dashboard/mobile-sidebar";
import { NAV_ITEMS } from "@/components/dashboard/nav-items";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Logo } from "@/components/logo";
import { NotConnected } from "@/components/not-connected";
import { AnalyticsProvider } from "@/components/providers/analytics-provider";
import { Badge } from "@/components/ui/badge";
import { publicEnv } from "@/lib/env";
import { humanize } from "@/lib/format";
import { analyticsIdFor } from "@/server/analytics-id";
import { getSessionState } from "@/server/auth/context";
import { hasPermission } from "@/server/auth/permissions";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const state = await getSessionState();
  if (state.kind === "signed_out") redirect("/sign-in");
  if (state.kind === "not_connected") return <NotConnected />;
  if (state.kind !== "member") redirect("/onboarding");
  const { ctx } = state;

  const items = NAV_ITEMS.filter((item) => hasPermission(ctx.role, item.permission));

  return (
    <AnalyticsProvider
      apiKey={publicEnv.NEXT_PUBLIC_POSTHOG_KEY}
      apiHost={publicEnv.NEXT_PUBLIC_POSTHOG_HOST}
      analyticsUserId={analyticsIdFor(ctx.userId)}
      clinicId={ctx.clinicId}
    >
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
          <div className="flex h-16 items-center px-5">
            <Logo href="/dashboard" />
          </div>
          <p className="eyebrow truncate px-6 pt-2 pb-1 text-ink-500">{ctx.clinicName}</p>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <SidebarNav items={items} />
          </div>
          <div className="border-t p-3">
            <AnalyticsToggle />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col bg-brand-50/40">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-hairline bg-white/85 px-4 backdrop-blur sm:px-6">
            <MobileSidebar items={items} clinicName={ctx.clinicName} />
            <div className="min-w-0 flex-1">
              <OrganizationSwitcher
                hidePersonal
                afterSelectOrganizationUrl="/dashboard"
                afterCreateOrganizationUrl="/onboarding"
                afterLeaveOrganizationUrl="/onboarding"
              />
            </div>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {humanize(ctx.role)}
            </Badge>
            <UserButton />
          </header>
          <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </AnalyticsProvider>
  );
}
