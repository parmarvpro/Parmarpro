import { EyebrowTag } from "@/components/brand/eyebrow-tag";
import { Halftone } from "@/components/brand/halftone";
import { cn } from "@/lib/utils";

/** Framed page header for marketing pages: eyebrow tag, display headline, intro. */
export function PageHero({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-6xl px-4 pt-8 sm:px-6", className)}>
      <div className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-white">
        <Halftone map="corner" className="absolute inset-y-0 right-0 w-full md:w-3/5" />
        <div className="relative max-w-2xl space-y-5 p-8 md:p-12">
          <EyebrowTag>{eyebrow}</EyebrowTag>
          <h1 className="headline text-4xl text-brand-500 sm:text-5xl md:text-6xl">{title}</h1>
          {children ? <div className="max-w-xl text-lg text-ink-600">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
