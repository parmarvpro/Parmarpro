import { Badge } from "@/components/ui/badge";
import { humanize } from "@/lib/format";

type Variant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

const VARIANTS: Record<string, Variant> = {
  // leads
  new: "default",
  contacted: "secondary",
  qualified: "secondary",
  appointment_booked: "default",
  converted: "success",
  lost: "destructive",
  // appointments
  scheduled: "secondary",
  confirmed: "default",
  completed: "success",
  cancelled: "destructive",
  no_show: "warning",
  // tasks
  open: "secondary",
  done: "success",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANTS[status] ?? "outline"}>{humanize(status)}</Badge>;
}
