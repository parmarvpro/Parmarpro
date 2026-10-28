/**
 * Small looping illustrations for the feature tiles. Pure SVG + CSS, decorative,
 * paused by the motion control, still under reduced motion. No text, no data.
 */

const frame = "h-24 w-full text-brand-500";

export function LeadsArt() {
  return (
    <svg viewBox="0 0 160 80" className={frame} aria-hidden="true" fill="none">
      {[8, 60, 112].map((x) => (
        <rect key={x} x={x} y="6" width="40" height="68" rx="8" stroke="currentColor" strokeOpacity="0.25" />
      ))}
      <rect x="14" y="16" width="28" height="12" rx="4" fill="currentColor" fillOpacity="0.2" />
      <rect x="14" y="34" width="28" height="12" rx="4" fill="currentColor" fillOpacity="0.2" />
      <rect x="66" y="16" width="28" height="12" rx="4" fill="currentColor" fillOpacity="0.2" />
      <rect className="art-slide" x="14" y="52" width="28" height="12" rx="4" fill="currentColor" />
    </svg>
  );
}

export function AppointmentsArt() {
  const cells = Array.from({ length: 15 }, (_, i) => ({ x: 12 + (i % 5) * 28, y: 8 + Math.floor(i / 5) * 22, i }));
  const lit = new Set([3, 7, 11]);
  return (
    <svg viewBox="0 0 160 80" className={frame} aria-hidden="true" fill="none">
      {cells.map(({ x, y, i }) => (
        <rect
          key={i}
          x={x}
          y={y}
          width="22"
          height="16"
          rx="4"
          fill="currentColor"
          fillOpacity={lit.has(i) ? 1 : 0.14}
          className={lit.has(i) ? "art-blink" : undefined}
          style={lit.has(i) ? { animationDelay: `${(i % 4) * 0.9}s` } : undefined}
        />
      ))}
    </svg>
  );
}

export function TasksArt() {
  return (
    <svg viewBox="0 0 160 80" className={frame} aria-hidden="true" fill="none">
      {[0, 1, 2].map((row) => (
        <g key={row} transform={`translate(14 ${8 + row * 24})`}>
          <rect width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" />
          <path className="art-tick" d="M3.5 8.5l3.2 3.2 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: `${row * 0.8}s` }} />
          <rect x="26" y="4" width={90 - row * 18} height="8" rx="4" fill="currentColor" fillOpacity="0.18" />
        </g>
      ))}
    </svg>
  );
}

export function RolesArt() {
  return (
    <svg viewBox="0 0 160 80" className={frame} aria-hidden="true" fill="none">
      <circle cx="80" cy="40" r="12" fill="currentColor" />
      <circle cx="80" cy="40" r="26" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 4" />
      <circle cx="80" cy="40" r="38" stroke="currentColor" strokeOpacity="0.18" />
      <g className="art-orbit">
        <circle cx="80" cy="14" r="5" fill="currentColor" />
        <circle cx="106" cy="52" r="4" fill="currentColor" fillOpacity="0.55" />
        <circle cx="54" cy="52" r="4" fill="currentColor" fillOpacity="0.55" />
      </g>
    </svg>
  );
}

export function DashboardArt() {
  return (
    <svg viewBox="0 0 160 80" className={frame} aria-hidden="true" fill="none">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          className="art-bar"
          x={16 + i * 22}
          y={10}
          width="14"
          height={[40, 62, 48, 70, 54, 66][i]}
          rx="4"
          fill="currentColor"
          fillOpacity={i === 3 ? 1 : 0.28}
          style={{ animationDelay: `${i * 0.25}s`, transformOrigin: "bottom" }}
        />
      ))}
    </svg>
  );
}

export function ActivityArt() {
  return (
    <svg viewBox="0 0 160 80" className={frame} aria-hidden="true" fill="none">
      <path d="M24 8v64" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
      {[0, 1, 2].map((row) => (
        <g key={row} transform={`translate(24 ${14 + row * 26})`}>
          <circle r="6" fill="currentColor" className="art-blink" style={{ animationDelay: `${row * 1.1}s` }} />
          <rect x="18" y="-5" width={86 - row * 16} height="10" rx="5" fill="currentColor" fillOpacity="0.16" />
        </g>
      ))}
    </svg>
  );
}
