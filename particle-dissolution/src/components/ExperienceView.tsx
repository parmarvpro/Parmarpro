'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Experience,
  ShaderCompileError,
  WebGLUnavailableError,
  type ExperienceInfo,
  type ExperienceStatus,
} from '@/engine/Experience';
import Hud from './Hud';

const INITIAL: ExperienceStatus = {
  mode: 'auto',
  heading: 'toCrowd',
  progress: 0,
  stage: 'Character',
  scrollMode: false,
  reducedMotion: false,
};

type Phase = 'loading' | 'ready' | 'unsupported' | 'shader' | 'error';

const FAILURE = {
  unsupported: {
    title: 'This needs WebGL 2',
    body: 'The particle experience renders in real time on your graphics card. Try a current version of Chrome, Edge, Firefox or Safari with hardware acceleration enabled.',
  },
  shader: {
    title: 'Your graphics driver stumbled',
    body: 'The shaders behind this effect could not be compiled on this device. Updating the browser or graphics driver usually fixes it.',
  },
  error: {
    title: 'Something went wrong',
    body: 'The experience could not start. Reload the page, or try a different browser.',
  },
} as const;

export default function ExperienceView({ characterSrc }: { characterSrc: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const experience = useRef<Experience | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState<ExperienceStatus>(INITIAL);
  const [info, setInfo] = useState<ExperienceInfo | null>(null);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const abort = new AbortController();
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let created: Experience | null = null;

    Experience.create({
      container: el,
      characterSrc,
      reducedMotion: reducedQuery.matches,
      signal: abort.signal,
      onStatus: setStatus,
    })
      .then((exp) => {
        if (abort.signal.aborted) {
          exp.dispose();
          return;
        }
        created = exp;
        experience.current = exp;
        setInfo(exp.info);
        setStatus(exp.status);
        setPhase('ready');
        if (new URLSearchParams(window.location.search).has('debug')) {
          window.__dissolve = {
            freeze: (p, d, t) => exp.freeze(p, d, t),
            release: () => exp.release(),
            status: () => exp.status,
            info: exp.info,
          };
        }
      })
      .catch((err: unknown) => {
        if (abort.signal.aborted) return;
        console.error('[dissolve]', err);
        if (err instanceof WebGLUnavailableError) setPhase('unsupported');
        else if (err instanceof ShaderCompileError) setPhase('shader');
        else setPhase('error');
      });

    // Follow the OS setting live (e.g. toggled while the page is open).
    const onReduced = (e: MediaQueryListEvent) => experience.current?.setReducedMotion(e.matches);
    reducedQuery.addEventListener('change', onReduced);

    return () => {
      abort.abort();
      reducedQuery.removeEventListener('change', onReduced);
      created?.dispose();
      experience.current = null;
      delete window.__dissolve;
    };
  }, [characterSrc]);

  const toggle = useCallback(() => experience.current?.toggle(), []);
  const auto = useCallback((on: boolean) => experience.current?.setAuto(on), []);
  const scroll = useCallback((on: boolean) => experience.current?.setScrollMode(on), []);
  const reduced = useCallback((on: boolean) => experience.current?.setReducedMotion(on), []);
  const seek = useCallback((p: number) => experience.current?.seek(p), []);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#15161a]">
      <div ref={container} className="absolute inset-0" />

      {phase === 'loading' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] uppercase tracking-[0.32em] text-white/45">
          <span className="animate-pulse">Preparing particles</span>
        </div>
      )}

      {(phase === 'unsupported' || phase === 'shader' || phase === 'error') && (
        <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_50%_40%,#2a2c33,#101114)] p-8 text-center">
          <div className="max-w-md">
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/50">Dissolve</p>
            <h1 className="mt-4 text-xl font-medium text-white/90">{FAILURE[phase].title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{FAILURE[phase].body}</p>
          </div>
        </div>
      )}

      {phase === 'ready' && (
        <Hud
          status={status}
          info={info}
          onToggle={toggle}
          onAuto={auto}
          onScroll={scroll}
          onReduced={reduced}
          onSeek={seek}
        />
      )}
    </main>
  );
}
