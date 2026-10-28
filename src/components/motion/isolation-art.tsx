/**
 * Two clinics with a barrier between them. Requests head for the barrier and
 * bounce back: each clinic's records stay separate (enforced by the database).
 * Decorative SVG; the surrounding text carries the meaning.
 */
export function IsolationArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 200" className={className} aria-hidden="true" fill="none">
      <rect x="8" y="20" width="132" height="160" rx="18" fill="#eef3ff" stroke="#bacdff" />
      <rect x="220" y="20" width="132" height="160" rx="18" fill="#eef3ff" stroke="#bacdff" />
      {[0, 1, 2].map((row) => (
        <g key={row}>
          <rect x="26" y={44 + row * 34} width={80 - row * 12} height="10" rx="5" fill="#1f5bff" fillOpacity={0.22 + row * 0.1} />
          <rect x="238" y={44 + row * 34} width={80 - row * 12} height="10" rx="5" fill="#1f5bff" fillOpacity={0.22 + row * 0.1} />
        </g>
      ))}
      <text x="26" y="160" fontSize="12" fontWeight="700" fill="#0b38b4" letterSpacing="0.08em">
        CLINIC A
      </text>
      <text x="238" y="160" fontSize="12" fontWeight="700" fill="#0b38b4" letterSpacing="0.08em">
        CLINIC B
      </text>
      <line className="art-dash" x1="180" y1="12" x2="180" y2="188" stroke="#1f5bff" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="180" cy="100" r="17" fill="#ffffff" stroke="#1f5bff" strokeWidth="2" />
      <path d="M173 100v-4a7 7 0 0 1 14 0v4m-16 0h18v11h-18z" stroke="#1f5bff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <g className="art-probe" style={{ transformBox: "fill-box" }}>
        <circle cx="118" cy="72" r="5" fill="#1f5bff" />
      </g>
      <g className="art-probe" style={{ animationDelay: "2.1s", transform: "scaleX(-1)", transformOrigin: "180px 0" }}>
        <circle cx="118" cy="128" r="5" fill="#1f5bff" fillOpacity="0.6" />
      </g>
    </svg>
  );
}
