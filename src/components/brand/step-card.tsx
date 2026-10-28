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
  className,
}: {
  number: string;
  label: string;
  word: string;
  children: React.ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  if (highlight) {
    return (
      <article
        className={cn(
          "flex min-h-80 flex-col justify-between rounded-2xl border border-brand-500 bg-linear-to-b from-brand-500 from-35% to-brand-100 p-6",
          className,
        )}
      >
        <div>
          <h3 className="headline text-3xl text-white sm:text-4xl">{word}</h3>
          <p className="mt-3 text-sm leading-relaxed text-white">{children}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="eyebrow text-brand-800">{label}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-brand-700/40" />
          <span className="text-3xl font-bold tracking-tight text-brand-700 tabular-nums">{number}</span>
        </div>
      </article>
    );
  }
  return (
    <article
      className={cn(
        "flex min-h-80 flex-col justify-between rounded-2xl border border-hairline bg-linear-to-b from-white from-40% to-brand-500 p-6",
        className,
      )}
    >
      <div>
        <span className="text-3xl font-bold tracking-tight text-brand-500 tabular-nums">{number}</span>
        <p className="eyebrow mt-1">{label}</p>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-brand-800">{children}</p>
      </div>
      <h3 className="headline mt-8 text-3xl text-white sm:text-4xl">{word}</h3>
    </article>
  );
}
