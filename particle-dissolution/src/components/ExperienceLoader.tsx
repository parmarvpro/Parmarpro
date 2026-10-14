'use client';

import dynamic from 'next/dynamic';

/**
 * Three.js touches `window`/WebGL, so the experience is client-only. Loading it through a dynamic
 * import also keeps ~600 kB of three.js out of the initial server-rendered payload.
 */
const ExperienceView = dynamic(() => import('./ExperienceView'), {
  ssr: false,
  loading: () => <Splash label="Preparing particles" />,
});

export function Splash({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 grid place-items-center bg-[#15161a] text-[11px] uppercase tracking-[0.32em] text-white/45">
      <span className="animate-pulse">{label}</span>
    </div>
  );
}

export default function ExperienceLoader({ characterSrc }: { characterSrc: string | null }) {
  return <ExperienceView characterSrc={characterSrc} />;
}
