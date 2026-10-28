import { Sparkle } from "@/components/brand/sparkle";

/**
 * Short blue curtain that wipes up over the first paint of the home page.
 * Pure CSS, so it plays from the server HTML with no flash and no JavaScript.
 * It never takes pointer events, never hides content from screen readers, and
 * is removed entirely for visitors who prefer reduced motion.
 */
export function IntroCurtain() {
  return (
    <div className="curtain" aria-hidden="true">
      <Sparkle tone="white" className="curtain-mark size-28 sm:size-36" />
    </div>
  );
}
