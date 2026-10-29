import { EyebrowTag } from "@/components/brand/eyebrow-tag";
import { AccentWords } from "@/components/brand/accent-words";
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
        <div className="relative max-w-2xl space-y-5 p-8 md:p-12">
          <EyebrowTag>{eyebrow}</EyebrowTag>
          <h1 className="headline text-[clamp(1.75rem,4.2vw+0.4rem,3.75rem)] text-brand-500">
            <AccentWords text={title} accent={accent} />
          </h1>
          {children ? <div className="max-w-xl text-lg text-ink-600">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
