"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";

import { useActionSubmit } from "@/components/forms/use-action-submit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Result = { ok: true; data: unknown } | { ok: false; code: string; message: string };

export function ConfirmActionButton({
  label,
  title,
  description,
  confirmLabel = "Confirm",
  action,
  success,
  variant = "outline",
  size = "sm",
  onDone,
  icon,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  action: () => Promise<Result>;
  success: string;
  variant?: "outline" | "destructive" | "ghost" | "default";
  size?: "sm" | "default" | "icon";
  onDone?: () => void;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useActionSubmit({
    success,
    onSuccess: () => {
      setOpen(false);
      onDone?.();
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} aria-label={size === "icon" ? label : undefined}>
          {icon}
          {size === "icon" ? null : label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant={variant === "destructive" ? "destructive" : "default"} disabled={pending} onClick={() => run(action)}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
