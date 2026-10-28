"use client";

import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";

import { Field } from "@/components/forms/field";
import { useActionSubmit } from "@/components/forms/use-action-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { setAppointmentStatusAction } from "@/server/actions/appointments";

const TRANSITIONS: Record<string, { status: string; label: string }[]> = {
  scheduled: [
    { status: "confirmed", label: "Mark confirmed" },
    { status: "completed", label: "Mark completed" },
    { status: "no_show", label: "Mark no-show" },
    { status: "cancelled", label: "Cancel appointment" },
  ],
  confirmed: [
    { status: "scheduled", label: "Mark unconfirmed" },
    { status: "completed", label: "Mark completed" },
    { status: "no_show", label: "Mark no-show" },
    { status: "cancelled", label: "Cancel appointment" },
  ],
};

export function AppointmentStatusMenu({ id, status }: { id: string; status: string }) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const { pending, run } = useActionSubmit({ success: "Appointment updated", onSuccess: () => setCancelOpen(false) });
  const options = TRANSITIONS[status];
  if (!options) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Update status <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Change status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuItem
              key={option.status}
              className={option.status === "cancelled" ? "text-destructive focus:text-destructive" : undefined}
              onSelect={() => {
                if (option.status === "cancelled") setCancelOpen(true);
                else run(() => setAppointmentStatusAction(id, { status: option.status }));
              }}
            >
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel appointment</DialogTitle>
            <DialogDescription>Cancelled appointments can&apos;t be reopened. Book a new one if the patient reschedules.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const reason = new FormData(event.currentTarget).get("cancelReason");
              run(() => setAppointmentStatusAction(id, { status: "cancelled", cancelReason: typeof reason === "string" ? reason : "" }));
            }}
            className="space-y-4"
          >
            <Field label="Reason (optional)" htmlFor="cancelReason">
              <Input id="cancelReason" name="cancelReason" maxLength={300} placeholder="e.g. Patient requested a different week" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
                Keep appointment
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                Cancel appointment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
