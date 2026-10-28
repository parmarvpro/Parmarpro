import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("relative flex w-full gap-3 rounded-xl border px-4 py-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", {
  variants: {
    variant: {
      default: "bg-card text-card-foreground",
      info: "border-brand-200 bg-brand-50 text-foreground [&>svg]:text-primary",
      warning: "border-warning/40 bg-warning/10 text-foreground [&>svg]:text-warning",
      destructive: "border-destructive/30 bg-destructive/5 text-foreground [&>svg]:text-destructive",
      success: "border-success/30 bg-success/5 text-foreground [&>svg]:text-success",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("font-medium leading-tight", className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("mt-1 text-muted-foreground [&_p]:leading-relaxed", className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
