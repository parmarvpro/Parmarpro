"use client";

import { useEffect, useRef } from "react";

import { CounterFlowField } from "@/components/motion/counter-flow-field";
import { PauseMotion } from "@/components/motion/pause-motion";
import { CardColumn } from "@/components/motion/stage-cards";
import { Badge } from "@/components/ui/badge";
import { panelTone, parallaxYPercent, type PanelIndex } from "@/lib/motion/counter-flow";
import { loadGsap } from "@/lib/motion/gsap";
import { useMotionEnabled } from "@/lib/motion/motion-state";
import { cn } from "@/lib/utils";

const PANELS: PanelIndex[] = [0, 1, 2];

/**
 * Three separate blocks in a line. The outer two flow up together and the
 * middle one flows down at the same speed, in inverted tones. Behind the
 * cards is one WebGL dot field; beneath that is a CSS-only fallback.
 */
export function CounterFlowStage({ className }: { className?: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const enabled = useMotionEnabled();

  // Scroll parallax on the card layers: outer cards drift one way while the
  // middle cards drift the other. The frames stay locked to the canvas.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let context: { revert: () => void } | undefined;
    void loadGsap().then(({ gsap }) => {
      const stage = stageRef.current;
      if (cancelled || !stage) return;
      context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>("[data-parallax]", stage).forEach((layer) => {
          const index = Number(layer.dataset.panel) as PanelIndex;
          gsap.fromTo(
            layer,
            { yPercent: parallaxYPercent(index, 0) },
            {
              yPercent: parallaxYPercent(index, 1),
              ease: "none",
              scrollTrigger: { trigger: stage, start: "top bottom", end: "bottom top", scrub: 0.6 },
            },
          );
        });
      }, stage);
    });
    return () => {
      cancelled = true;
      context?.revert();
    };
  }, [enabled]);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={stageRef}
        role="img"
        aria-label="Illustration of ParmarPro inquiry, appointment and follow-up task cards in three moving columns, using sample data."
        className="cf-stage"
      >
        <CounterFlowField />
        <div className="cf-fallback" aria-hidden="true">
          {PANELS.map((index) => (
            <div key={index} className="cf-panel" style={{ "--i": index } as React.CSSProperties} data-tone={panelTone(index)} data-mid={index === 1}>
              <div className="cf-dots" data-direction={index === 1 ? "reverse" : "normal"} />
            </div>
          ))}
        </div>
        {PANELS.map((index) => (
          <div key={index} className="cf-panel cf-live" style={{ "--i": index } as React.CSSProperties} data-mid={index === 1} aria-hidden="true">
            <CardColumn index={index} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Badge variant="warning">Illustration · sample data</Badge>
        <PauseMotion />
      </div>
    </div>
  );
}
