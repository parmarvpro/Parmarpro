import { Fragment } from "react";

/**
 * Headline whose words rise out of a mask, one after another. Pure CSS: the
 * animation starts on first paint from the server HTML, so there is no flash
 * and no JavaScript dependency. The text content is unchanged, so screen
 * readers and tests still see the plain sentence.
 */
export function SplitWords({
  text,
  accent = [],
  startAt = 0,
}: {
  text: string;
  /** Lower-case words (without punctuation) to set in the italic serif accent. */
  accent?: string[];
  /** Index offset, so several lines can share one stagger. */
  startAt?: number;
}) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, index) => {
        const bare = word.toLowerCase().replace(/[^a-z0-9]/g, "");
        const isAccent = accent.includes(bare);
        return (
          <Fragment key={`${word}-${index}`}>
            <span className="word-mask">
              <span className={isAccent ? "accent" : undefined} style={{ "--i": startAt + index } as React.CSSProperties}>
                {word}
              </span>
            </span>
            {index < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </>
  );
}
