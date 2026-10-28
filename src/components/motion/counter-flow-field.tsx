"use client";

import { useCallback, useEffect, useRef } from "react";

import { createDitherRenderer, type DitherController, type DitherLayout } from "@/lib/motion/dither-shader";
import { prefersReducedMotion, saveDataRequested, useMotionEnabled } from "@/lib/motion/motion-state";
import { getScrollVelocity } from "@/lib/motion/scroll-velocity";

/** Sizes live in CSS custom properties on `.cf-stage`, so breakpoints stay in one place. */
function readLayout(stage: HTMLElement): DitherLayout {
  const style = getComputedStyle(stage);
  const read = (name: string, fallback: number) => parseFloat(style.getPropertyValue(name)) || fallback;
  return {
    cellPx: read("--cf-cell", 3.5),
    gutterPx: read("--cf-gutter", 16),
    radiusPx: read("--cf-radius", 28),
    offsetPx: read("--cf-offset", 28),
  };
}

/**
 * The WebGL layer of the counter-flow stage. If WebGL is unavailable, the GPU
 * context is lost, or motion is switched off at load, the canvas simply stays
 * "not live" and the CSS fallback panels beneath it remain visible.
 */
export function CounterFlowField() {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<DitherController | null>(null);
  const gates = useRef({ enabled: true, visible: false, hidden: false });
  const enabled = useMotionEnabled();

  const apply = useCallback(() => {
    const { enabled: on, visible, hidden } = gates.current;
    controllerRef.current?.setPaused(!(on && visible && !hidden));
  }, []);

  useEffect(() => {
    gates.current.enabled = enabled;
    apply();
  }, [enabled, apply]);

  useEffect(() => {
    const host = hostRef.current;
    const stage = host?.parentElement;
    if (!host || !stage) return;

    // A fresh canvas for every mount: once a GPU context is released, the same
    // canvas can never create another one (React strict mode mounts twice in development).
    const canvas = document.createElement("canvas");
    canvas.className = "cf-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);

    const controller = createDitherRenderer(canvas, {
      ...readLayout(stage),
      speed: 0.083,
      maxDpr: 1.5,
      reducedMotion: prefersReducedMotion() || saveDataRequested(),
      readScrollVelocity: getScrollVelocity,
      onContextLost: () => {
        stage.dataset.live = "false";
      },
    });
    if (!controller) {
      canvas.remove();
      return;
    }
    controllerRef.current = controller;
    stage.dataset.live = "true";
    controller.start();
    apply();

    const resizeObserver = new ResizeObserver(() => {
      controller.configure(readLayout(stage));
      controller.resize();
    });
    resizeObserver.observe(canvas);

    const intersection = new IntersectionObserver(
      ([entry]) => {
        gates.current.visible = entry?.isIntersecting ?? false;
        apply();
      },
      { rootMargin: "120px" },
    );
    intersection.observe(canvas);

    const onVisibility = () => {
      gates.current.hidden = document.hidden;
      apply();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let pointerFrame = 0;
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || pointerFrame) return;
      const { clientX, clientY } = event;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        const rect = canvas.getBoundingClientRect();
        controller.setPointer(clientX - rect.left, clientY - rect.top);
      });
    };
    stage.addEventListener("pointermove", onPointerMove);

    return () => {
      cancelAnimationFrame(pointerFrame);
      stage.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      intersection.disconnect();
      resizeObserver.disconnect();
      controller.dispose();
      controllerRef.current = null;
      canvas.remove();
      stage.dataset.live = "false";
    };
  }, [apply]);

  return <div ref={hostRef} className="cf-canvas-host" aria-hidden="true" />;
}
