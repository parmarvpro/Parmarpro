'use client';

import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import type { ExperienceInfo, ExperienceStatus } from '@/engine/Experience';

interface HudProps {
  status: ExperienceStatus;
  info: ExperienceInfo | null;
  onToggle: () => void;
  onAuto: (on: boolean) => void;
  onScroll: (on: boolean) => void;
  onReduced: (on: boolean) => void;
  onSeek: (p: number) => void;
}

/** Primary action wording follows where the particles are and where they are heading. */
function actionLabel(s: ExperienceStatus): string {
  if (s.progress <= 0.0005) return 'Dissolve';
  if (s.progress >= 0.9995) return 'Reform';
  return 'Turn back';
}

function announcement(s: ExperienceStatus): string {
  if (s.progress <= 0.0005) return 'Pixel character';
  if (s.progress >= 0.9995) return 'Crowd';
  return s.heading === 'toCrowd' ? 'Dissolving into a crowd' : 'Reforming into the character';
}

function Toggle({
  pressed,
  onClick,
  children,
  title,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className={
        'rounded-full px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.18em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80 ' +
        (pressed ? 'bg-white/90 text-neutral-900' : 'bg-white/[0.08] text-white/75 hover:bg-white/[0.16]')
      }
    >
      {children}
    </button>
  );
}

export default function Hud({ status, info, onToggle, onAuto, onScroll, onReduced, onSeek }: HudProps) {
  // Fade the chrome out when the pointer is idle so the piece stays cinematic; focus brings it back.
  const [awake, setAwake] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wake = () => {
      setAwake(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setAwake(false), 3800);
    };
    wake();
    window.addEventListener('pointermove', wake);
    window.addEventListener('pointerdown', wake);
    window.addEventListener('keydown', wake);
    return () => {
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const fill = `${(status.progress * 100).toFixed(1)}%`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 sm:p-6 text-white">
        {/* live region for assistive tech: one calm sentence per state change */}
        <p className="sr-only" aria-live="polite">
          {announcement(status)}
        </p>

        <motion.header
          className="flex items-start justify-between gap-4 text-[10.5px] uppercase tracking-[0.3em] text-white mix-blend-difference"
          animate={{ opacity: awake ? 1 : 0.0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <span>Dissolve</span>
          {info && (
            <span className="hidden text-right tabular-nums sm:block">
              {info.particles.toLocaleString('en-US')} particles
              <span className="mx-2 opacity-40">·</span>
              {info.tier}
              {info.source === 'procedural' ? '' : ' · custom art'}
            </span>
          )}
        </motion.header>

        <motion.footer
          className="pointer-events-auto mx-auto w-full max-w-[560px]"
          animate={{ opacity: awake ? 1 : 0.0, y: awake ? 0 : 6 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          onFocusCapture={() => setAwake(true)}
        >
          <div className="rounded-2xl border border-white/10 bg-neutral-950/65 px-4 pb-3 pt-3 shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
            <div className="mb-1 flex items-center justify-between gap-3">
              <div className="h-4 min-w-[8.5rem] overflow-hidden text-[10.5px] uppercase tracking-[0.26em] text-white/85">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={status.stage}
                    className="block"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {status.stage}
                  </motion.span>
                </AnimatePresence>
              </div>
              <button
                type="button"
                onClick={onToggle}
                className="rounded-full bg-white/90 px-4 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-neutral-900 transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {actionLabel(status)}
              </button>
            </div>

            <input
              className="scrubber"
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(status.progress * 1000)}
              style={{ ['--fill' as string]: fill }}
              aria-label="Transition progress: pixel character to crowd"
              aria-valuetext={`${Math.round(status.progress * 100)} percent`}
              onChange={(e) => onSeek(Number(e.target.value) / 1000)}
            />

            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/65">
                Click · Space · <span className="whitespace-nowrap">Drag the line</span>
              </p>
              <div className="flex items-center gap-1.5">
                <Toggle
                  pressed={status.mode === 'auto'}
                  onClick={() => onAuto(status.mode !== 'auto')}
                  title="Play the 19-second cinematic loop"
                >
                  Auto
                </Toggle>
                <Toggle
                  pressed={status.scrollMode}
                  onClick={() => onScroll(!status.scrollMode)}
                  title="Scrub the transition with the mouse wheel or a vertical swipe"
                >
                  Scroll
                </Toggle>
                <Toggle
                  pressed={status.reducedMotion}
                  onClick={() => onReduced(!status.reducedMotion)}
                  title="Calmer motion: no autoplay, gentler flow"
                >
                  Calm
                </Toggle>
              </div>
            </div>
          </div>
        </motion.footer>
      </div>
    </MotionConfig>
  );
}
