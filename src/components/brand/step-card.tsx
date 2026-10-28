import { DotDrift } from "@/components/motion/dot-drift";
import type { PanelIndex } from "@/lib/motion/counter-flow";
import { cn } from "@/lib/utils";

/**
 * Numbered step card (01 / 02 / 03). Regular cards fade from white to brand blue
 * with the big word at the bottom; the highlight card is the inverse.
 */
export function StepCard({
  number,
  label,
  word,
  children,
  highlight = false,
  flow,
  className,
}: {
  number: string;
  label: string;
  word: string;
  children: React.ReactNode;
  highlight?: boolean;
  /** Position in the row (0, 1, 2). Gives the card its counter-flow dots and scroll offset. */
  flow?: PanelIndex;
  className?: string;
}) {
  if (highlight) {
    return (
      <article
        data-step={flow}
        className={cn(
          "relative flex min-h-80 flex-col justify-between overflow-hidden rounded-2xl border border-brand-500 bg-linear-to-b from-brand-500 from-35% to-brand-100 p-6",
          className,
        )}
      >
        {flow !== undefined ? (
          <DotDrift index={flow} className="opacity-40" style={{ "--dot-mask": "linear-gradient(to bottom, #000, transparent 62%)" } as React.CSSProperties} />
        ) : null}
        <div className="relative">
          <h3 className="headline text-3xl text-white sm:text-4xl">{word}</h3>
          <p className="mt-3 text-sm leading-relaxed text-white">{children}</p>
        </div>
        <div className="relative flex items-center gap-3">
          <span className="eyebrow text-brand-800">{label}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-brand-700/40" />
          <span className="text-3xl font-bold tracking-tight text-brand-700 tabular-nums">{number}</span>
        </div>
      </article>
    );
  }
  return (
    <article
      data-step={flow}
      className={cn(
        "relative flex min-h-80 flex-col justify-between overflow-hidden rounded-2xl border border-hairline bg-linear-to-b from-white from-40% to-brand-500 p-6",
        className,
      )}
    >
      {flow !== undefined ? (
        <DotDrift
          index={flow}
          className="opacity-45"
          style={{ "--dot-mask": "linear-gradient(to bottom, transparent 22%, #000 52%, transparent 84%)" } as React.CSSProperties}
        />
      ) : null}
      <div className="relative">
        <span className="text-3xl font-bold tracking-tight text-brand-500 tabular-nums">{number}</span>
        <p className="eyebrow mt-1">{label}</p>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-brand-800">{children}</p>
      </div>
      <h3 className="headline relative mt-8 text-3xl text-white sm:text-4xl">{word}</h3>
    </article>
  );
}
