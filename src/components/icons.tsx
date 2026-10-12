import type { JSX, SVGProps } from 'react';
import type { ServiceIcon } from '@/lib/profile';

type P = SVGProps<SVGSVGElement>;
const S = (p: P) => ({ viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p });

export const Phone = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" />
  </svg>
);
export const Pin = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
  </svg>
);
export const Leaf = (p: P) => <svg {...S({ stroke: '#fff', strokeWidth: 2, ...p })}><path d="M5 19c0-8 5-13 14-14-.5 9-6 14-14 14z" /><path d="M5 19c3-4 6-7 10-9" /></svg>;
export const Check = (p: P) => <svg {...S({ strokeWidth: 2.2, ...p })}><path d="M4.5 12.5l5 5 10-11" /></svg>;
export const Home = (p: P) => <svg {...S(p)}><path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5" /></svg>;
export const Award = (p: P) => <svg {...S(p)}><circle cx="12" cy="9" r="5.5" /><path d="M8.5 13.5 7 21l5-2.5 5 2.5-1.5-7.5" /></svg>;
export const Cal = (p: P) => <svg {...S(p)}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>;
export const Pulse = (p: P) => <svg {...S(p)}><path d="M3 12h4l2.5-6 5 12L17 12h4" /></svg>;
export const Star = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />
  </svg>
);
export const Camera = (p: P) => <svg {...S(p)}><path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h2l1.5-2h6l1.5 2h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.6" /></svg>;
export const Tag = (p: P) => <svg {...S(p)}><path d="M3.5 12.5V4h8.5l9 9-8.5 8.5z" /><circle cx="8" cy="8.5" r="1.4" fill="currentColor" /></svg>;
export const Map = (p: P) => <svg {...S(p)}><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6zM9 4v14M15 6v14" /></svg>;
export const Clock = (p: P) => <svg {...S(p)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
export const Siren = (p: P) => <svg {...S(p)}><path d="M6 18v-5a6 6 0 0 1 12 0v5M4 18h16v3H4zM12 3v2M4.2 6.2l1.4 1.4M19.8 6.2l-1.4 1.4" /></svg>;
export const Dollar = (p: P) => <svg {...S(p)}><path d="M12 3v18M16.5 7.5c-.6-1.4-2.3-2.3-4.5-2.3-2.6 0-4.3 1.3-4.3 3.2 0 4.5 9 2.3 9 6.9 0 2-1.9 3.4-4.7 3.4-2.4 0-4.2-1-4.8-2.6" /></svg>;
export const Chat = (p: P) => <svg {...S(p)}><path d="M4 5.5h16v10H9l-5 4z" /></svg>;
export const Pen = (p: P) => <svg {...S(p)}><path d="M4 20l1-4L16 5l3 3L8 19l-4 1z" /></svg>;
export const Badge = (p: P) => <svg {...S(p)}><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="8.5" cy="12" r="2.5" /><path d="M13.5 10h4.5M13.5 14h3" /></svg>;
export const Hist = (p: P) => <svg {...S(p)}><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5M12 8v4l2.5 1.5" /></svg>;
export const Share = (p: P) => <svg {...S(p)}><circle cx="9" cy="9" r="3.3" /><path d="M3.5 19c.9-3 3-4.6 5.5-4.6s4.6 1.6 5.5 4.6M17.5 8v6M14.5 11h6" /></svg>;
export const Eye = (p: P) => <svg {...S(p)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></svg>;
export const Plus = (p: P) => <svg {...S(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const X = (p: P) => <svg {...S(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>;

const SERVICE: Record<ServiceIcon, (p: P) => JSX.Element> = {
  flame: (p) => <svg {...S(p)}><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.4 1.3-3.8 2.5-5 .3 1.6 1 2.5 2 3 0-3-.5-5.5.5-8z" /></svg>,
  snow: (p) => <svg {...S(p)}><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5" /></svg>,
  fan: (p) => <svg {...S(p)}><circle cx="12" cy="12" r="1.8" /><path d="M12 10.2C11 6 12.5 3.5 15 3.5c2 0 2.5 3-3 6.7zM13.8 12c4.2-1 6.7.5 6.7 3 0 2-3 2.5-6.7-3zM12 13.8c1 4.2-.5 6.7-3 6.7-2 0-2.5-3 3-6.7zM10.2 12C6 13 3.5 11.5 3.5 9c0-2 3-2.5 6.7 3z" /></svg>,
  wrench: (p) => <svg {...S(p)}><path d="M14.5 6.5a4 4 0 0 0 5 5l-9 9a2.1 2.1 0 0 1-3-3l9-9a4 4 0 0 1 5-5l-2.5 2.5.5 2 2 .5z" /></svg>,
  building: (p) => <svg {...S(p)}><path d="M4 20V5l8-2v17M12 20V9l8 2.5V20M2.5 20h19M7 8h2M7 12h2M7 16h2M15 13.5h2M15 17h2" /></svg>,
  pump: (p) => <svg {...S(p)}><rect x="3" y="5" width="18" height="13" rx="2.5" /><circle cx="9.5" cy="11.5" r="3.6" /><path d="M15.5 9h3M15.5 12h3M15.5 15h3M7 21h10" /></svg>,
  drop: (p) => <svg {...S(p)}><path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z" /></svg>,
  pipe: (p) => <svg {...S(p)}><path d="M3 8h7a3 3 0 0 1 3 3v10M3 12h6v9M17 21V11a7 7 0 0 0-7-7H3" /></svg>,
};
export function ServiceGlyph({ icon, ...p }: { icon?: ServiceIcon } & P) {
  const C = SERVICE[icon ?? 'wrench'] ?? SERVICE.wrench;
  return <C {...p} />;
}
