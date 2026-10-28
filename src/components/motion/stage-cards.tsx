import { ActivityIcon, CalendarCheck2Icon, ClipboardListIcon, InboxIcon, UsersIcon, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { columnAnimationDirection, type PanelIndex } from "@/lib/motion/counter-flow";

/**
 * Sample product cards for the counter-flow stage. Every card shows something
 * ParmarPro really does today (leads, appointments, follow-up tasks, team
 * roles, activity history). All names and times are made up and the stage is
 * labelled "Illustration · sample data".
 */

type Tone = "default" | "secondary" | "success" | "warning" | "destructive";
type Kind = "lead" | "appointment" | "task" | "team" | "activity";
type CardDef = { kind: Kind; title: string; meta: string; badge: string; tone: Tone };

const ICONS: Record<Kind, LucideIcon> = {
  lead: InboxIcon,
  appointment: CalendarCheck2Icon,
  task: ClipboardListIcon,
  team: UsersIcon,
  activity: ActivityIcon,
};

export const STAGE_COLUMNS: readonly [CardDef[], CardDef[], CardDef[]] = [
  [
    { kind: "lead", title: "Sample inquiry 1", meta: "WhatsApp · today", badge: "New", tone: "default" },
    { kind: "task", title: "Call back", meta: "Due today, 4:30 pm", badge: "Follow-up", tone: "secondary" },
    { kind: "lead", title: "Sample inquiry 4", meta: "Phone call · yesterday", badge: "Contacted", tone: "secondary" },
    { kind: "appointment", title: "Consultation", meta: "Fri, 10:30", badge: "Scheduled", tone: "secondary" },
    { kind: "team", title: "Front desk", meta: "Staff role", badge: "Can edit", tone: "secondary" },
    { kind: "task", title: "Send estimate", meta: "Due tomorrow", badge: "Open", tone: "secondary" },
    { kind: "lead", title: "Sample inquiry 7", meta: "Instagram · today", badge: "New", tone: "default" },
  ],
  [
    { kind: "appointment", title: "Consultation", meta: "Thu, 11:00", badge: "Confirmed", tone: "default" },
    { kind: "lead", title: "Sample inquiry 2", meta: "Walk-in", badge: "Appointment booked", tone: "default" },
    { kind: "task", title: "Follow up", meta: "Overdue by 1 day", badge: "Overdue", tone: "destructive" },
    { kind: "appointment", title: "Check-up", meta: "Mon, 09:15", badge: "Completed", tone: "success" },
    { kind: "activity", title: "Status changed", meta: "Contacted to Qualified", badge: "Activity", tone: "secondary" },
    { kind: "lead", title: "Sample inquiry 5", meta: "Referral", badge: "Converted", tone: "success" },
    { kind: "appointment", title: "Consultation", meta: "Wed, 17:45", badge: "Confirmed", tone: "default" },
  ],
  [
    { kind: "lead", title: "Sample inquiry 3", meta: "Website", badge: "New", tone: "default" },
    { kind: "appointment", title: "Procedure", meta: "Sat, 12:00", badge: "Confirmed", tone: "default" },
    { kind: "task", title: "Confirm visit", meta: "Due today", badge: "Open", tone: "secondary" },
    { kind: "lead", title: "Sample inquiry 6", meta: "Practo", badge: "Qualified", tone: "secondary" },
    { kind: "team", title: "Clinic owner", meta: "Owner role", badge: "Billing", tone: "secondary" },
    { kind: "appointment", title: "Follow-up visit", meta: "Tue, 16:00", badge: "No-show", tone: "warning" },
    { kind: "task", title: "Call back", meta: "Due tomorrow", badge: "Open", tone: "secondary" },
  ],
];

function SampleCard({ card }: { card: CardDef }) {
  const Icon = ICONS[card.kind];
  return (
    <div className="rounded-2xl bg-white p-2 shadow-[0_14px_32px_-18px_rgb(5_14_43/0.55)] ring-1 ring-brand-100 @[9rem]:p-3">
      <div className="flex items-center gap-2.5">
        <span className="hidden size-8 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white @[8.5rem]:flex">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] leading-[14px] font-semibold [overflow-wrap:anywhere] text-ink-900 @[9rem]:text-xs @[9rem]:leading-4">
            {card.title}
          </p>
          <p className="hidden truncate text-[11px] leading-4 text-ink-500 @[8.5rem]:block">{card.meta}</p>
        </div>
      </div>
      <Badge
        variant={card.tone}
        className="mt-1.5 max-w-full px-1.5 text-left text-[11px] leading-3 whitespace-normal @[9rem]:mt-2 @[9rem]:px-2.5"
      >
        {card.badge}
      </Badge>
    </div>
  );
}

/**
 * One scrolling column. Two identical groups sit one after the other so the
 * 40 s loop is seamless. The outer columns flow up; the middle is reversed.
 */
export function CardColumn({ index }: { index: PanelIndex }) {
  const cards = STAGE_COLUMNS[index];
  const group = (hidden: boolean) => (
    <div className="flex flex-col gap-2.5 pb-2.5 @[9rem]:gap-4 @[9rem]:pb-4" aria-hidden={hidden || undefined}>
      {cards.map((card, position) => (
        <SampleCard key={`${card.title}-${position}`} card={card} />
      ))}
    </div>
  );
  return (
    <div className="cf-cards @container absolute inset-x-2 inset-y-0 sm:inset-x-4">
      <div data-parallax data-panel={index} className="absolute inset-0">
        <div className="cf-column" data-direction={columnAnimationDirection(index)}>
          {group(false)}
          {group(true)}
        </div>
      </div>
    </div>
  );
}
