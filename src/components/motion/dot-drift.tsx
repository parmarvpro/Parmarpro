import { columnAnimationDirection, type PanelIndex } from "@/lib/motion/counter-flow";
import { cn } from "@/lib/utils";

/**
 * Dots that drift continuously. Follows the same counter-flow rule as the
 * stage: pass the block's index and the outer two rise while the middle falls.
 * Compositor-only (a transform), decorative, and paused with the motion control.
 */
export function DotDrift({
  index,
  className,
  style,
}: {
  index: PanelIndex;
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div aria-hidden="true" className={cn("dot-drift", className)} data-direction={columnAnimationDirection(index)} style={style} />;
}
