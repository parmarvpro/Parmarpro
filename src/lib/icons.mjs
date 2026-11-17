import { raw } from './html.mjs';

// 24x24 line icons (stroke = currentColor). Kept small and dependency-free.
const P = {
  tooth: '<path d="M7.5 3C5 3 3 5 3 7.6c0 2 .8 3.3 1.3 4.9.6 2 .8 4.3 1.4 6.3.4 1.4 1 2.2 1.9 2.2 1.5 0 1.6-2.8 2.4-4.8.4-1 1.1-1.6 2-1.6s1.6.6 2 1.6c.8 2 .9 4.8 2.4 4.8.9 0 1.5-.8 1.9-2.2.6-2 .8-4.3 1.4-6.3.5-1.6 1.3-2.9 1.3-4.9C21 5 19 3 16.5 3c-1.9 0-2.7 1-4.5 1S9.4 3 7.5 3z"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2.5 4 2.5 4-2.5 4-2.5"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  align: '<path d="M4 9h16M4 15h16"/><rect x="6" y="7" width="3" height="4" rx="1"/><rect x="10.5" y="7" width="3" height="4" rx="1"/><rect x="15" y="7" width="3" height="4" rx="1"/><rect x="6" y="13" width="3" height="4" rx="1"/><rect x="10.5" y="13" width="3" height="4" rx="1"/><rect x="15" y="13" width="3" height="4" rx="1"/>',
  implant: '<path d="M8 3h8l-1 5H9z"/><path d="M10 8h4M10 11h4M10.5 14h3M11 17h2l-1 4z"/>',
  baby: '<circle cx="12" cy="8" r="4"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  drop: '<path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 10h8M8 13h5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13"/><path d="M12 8S10.5 3 8 3.8C6 4.4 7 8 12 8zM12 8s1.5-5 4-4.2C18 4.4 17 8 12 8z"/>',
  wrench: '<path d="M14.5 5.5a4 4 0 0 0 5 5L21 9a6 6 0 0 1-8.3 6.9L6 22.5 1.5 18l6.6-6.7A6 6 0 0 1 15 3z"/>',
};

const WHATSAPP = '<path fill="currentColor" stroke="none" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.02c-.25.69-1.44 1.32-2 1.4-.51.08-1.15.11-1.86-.12-.43-.13-.98-.32-1.68-.62-2.96-1.28-4.89-4.26-5.04-4.46-.15-.2-1.2-1.6-1.2-3.05s.76-2.17 1.03-2.46c.27-.3.59-.37.79-.37h.57c.18.01.42-.07.66.5.25.59.84 2.04.91 2.19.07.15.12.32.02.52-.1.2-.15.32-.3.49l-.44.52c-.15.15-.3.31-.13.6.17.3.76 1.26 1.64 2.04 1.13 1 2.08 1.32 2.37 1.47.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.39-.25.66-.15.27.1 1.72.81 2.02.96.3.15.49.22.57.34.07.12.07.71-.18 1.4z"/>';

export function icon(name, cls = 'i') {
  const body = name === 'whatsapp' ? WHATSAPP : P[name] ?? P.tooth;
  return raw(
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
  );
}
