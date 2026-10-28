import { cn } from "@/lib/utils";

const MAPS = {
  radial: "",
  sweep: "ht-map-sweep",
  edge: "ht-map-edge",
  corner: "ht-map-corner",
  band: "ht-map-band",
} as const;

const CELLS = { fine: "ht-fine", default: "", coarse: "ht-coarse" } as const;

/**
 * Decorative dot-screen field (see the `halftone` utility in globals.css).
 * Blue dots on white by default; `inverse` gives white dots on blue.
 */
export function Halftone({
  map = "radial",
  cell = "default",
  inverse = false,
  className,
}: {
  map?: keyof typeof MAPS;
  cell?: keyof typeof CELLS;
  inverse?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("halftone pointer-events-none select-none", MAPS[map], CELLS[cell], inverse && "halftone-inverse", className)}
    />
  );
}
