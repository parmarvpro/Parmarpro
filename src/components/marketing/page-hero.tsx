import { EyebrowTag } from "@/components/brand/eyebrow-tag";
import { DotDrift } from "@/components/motion/dot-drift";
import { SplitWords } from "@/components/motion/split-words";
import { cn } from "@/lib/utils";

/** Framed page header for marketing pages: eyebrow tag, display headline, intro. */
export function PageHero({
  eyebrow,
  title,
  accent,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  /** Lower-case words in the title to set in the light-weight accent. */
  accent?: string[];
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-6xl px-4 pt-8 sm:px-6", className)}>
      <div className="relative overflow-hidden rounded-3xl border border-brand-500/30 bg-white">
        <DotDrift
          index={0}
          style={
            {
              "--dot": "#1f5bff",
              "--dot-mask": "linear-gradient(to bottom left, #000 0%, transparent 62%)",
            } as React.CSSProperties
          }
        />
        <div className="relative max-w-2xl space-y-5 p-8 md:p-12">
          <EyebrowTag>{eyebrow}</EyebrowTag>
          <h1 className="headline text-[clamp(1.75rem,4.2vw+0.4rem,3.75rem)] text-brand-500">
            <SplitWords text={title} accent={accent} />
          </h1>
          {children ? <div className="max-w-xl text-lg text-ink-600">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
