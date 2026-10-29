import { Fragment } from "react";

/**
 * Renders a headline with its accent words in the light-weight `accent` style.
 * Plain text, no animation: the DOM reads as the plain sentence.
 */
export function AccentWords({
  text,
  accent = [],
}: {
  text: string;
  /** Lower-case words (without punctuation) to set in the light-weight accent. */
  accent?: string[];
}) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, index) => {
        const bare = word.toLowerCase().replace(/[^a-z0-9]/g, "");
        const isAccent = accent.includes(bare);
        return (
          <Fragment key={`${word}-${index}`}>
            <span className={isAccent ? "accent" : undefined}>{word}</span>
            {index < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </>
  );
}
