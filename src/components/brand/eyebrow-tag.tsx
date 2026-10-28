import { cn } from "@/lib/utils";

/** Small pill label, e.g. above a hero headline. */
export function EyebrowTag({
  children,
  tone = "solid",
  className,
}: {
  children: React.ReactNode;
  tone?: "solid" | "soft" | "inverse";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold tracking-[0.1em] uppercase",
        tone === "solid" && "bg-brand-500 text-white",
        tone === "soft" && "bg-brand-50 text-brand-700 ring-1 ring-brand-200",
        tone === "inverse" && "bg-white text-brand-600",
        className,
      )}
    >
      {children}
    </span>
  );
}
