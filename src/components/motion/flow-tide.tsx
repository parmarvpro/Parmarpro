import { useId } from "react";

import { columnAnimationDirection, type PanelIndex } from "@/lib/motion/counter-flow";
import { TIDE_PERIOD_PX, TIDE_PITCH_PX, TIDE_ROWS, tideRadius } from "@/lib/motion/tide";
import { cn } from "@/lib/utils";

/**
 * A halftone tide: bands of dots that swell and shrink as they travel. It
 * follows the same counter-flow rule as the stage (pass the block's index: the
 * outer two rise, the middle falls). One SVG pattern, animated with a transform
 * only, decorative, and paused by the motion control.
 *
 * `tone="light"` is for blue backgrounds, `tone="blue"` for light ones.
 */
export function FlowTide({
  index,
  tone,
  className,
  style,
}: {
  index: PanelIndex;
  tone: "light" | "blue";
  className?: string;
  style?: React.CSSProperties;
}) {
  const id = `tide-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const centre = TIDE_PITCH_PX / 2;
  return (
    <div aria-hidden="true" className={cn("flow-tide", className)} data-tone={tone} style={style}>
      <svg
        className="flow-tide-layer"
        data-direction={columnAnimationDirection(index)}
        width="100%"
        height={TIDE_PERIOD_PX * 4}
        focusable="false"
      >
        <defs>
          <pattern id={id} width={TIDE_PITCH_PX} height={TIDE_PERIOD_PX} patternUnits="userSpaceOnUse">
            {Array.from({ length: TIDE_ROWS }, (_, row) => (
              <circle key={row} cx={centre} cy={centre + row * TIDE_PITCH_PX} r={tideRadius(row)} fill="currentColor" />
            ))}
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
    </div>
  );
}
