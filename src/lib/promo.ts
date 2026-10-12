// Promote: social posts, flyers, business cards, magnets and yard signs, all made
// from the same profile as the website. Output is SVG at the real size (print
// formats in inches with 1/8" bleed), so it previews in the browser and prints sharp.
// Pure and dependency-free.

import type { BusinessProfile } from './profile';
import { isPostalArea } from './profile';
import { fmtDate, isSpecialLive } from './time';
import { mix, onColour, readable } from './colour';

export type PromoCategory = 'social' | 'flyer' | 'card' | 'magnet' | 'sign';

export interface PromoFormat {
  id: string;
  category: PromoCategory;
  label: string;
  hint: string;
  /** Screen formats in px; print formats in inches (trim size, bleed added on export). */
  w: number;
  h: number;
  unit: 'px' | 'in';
  slides?: number;
  sides?: 2;
}

export const CATEGORIES: { id: PromoCategory; label: string; hint: string }[] = [
  { id: 'social', label: 'Social media', hint: 'Facebook and Instagram' },
  { id: 'flyer', label: 'Flyers', hint: 'Mailbox drops and job sites' },
  { id: 'card', label: 'Business cards', hint: 'For every truck' },
  { id: 'magnet', label: 'Magnets', hint: 'Fridges and trucks' },
  { id: 'sign', label: 'Yard signs', hint: 'Outside every job' },
];

export const FORMATS: PromoFormat[] = [
  { id: 'post', category: 'social', label: 'Post', hint: 'Square, 1080 × 1080', w: 1080, h: 1080, unit: 'px' },
  { id: 'carousel', category: 'social', label: 'Swipe post', hint: '4 pictures, 1080 × 1350', w: 1080, h: 1350, unit: 'px', slides: 4 },
  { id: 'story', category: 'social', label: 'Story', hint: 'Tall, 1080 × 1920', w: 1080, h: 1920, unit: 'px' },
  { id: 'flyer-letter', category: 'flyer', label: 'Letter flyer', hint: '8.5 × 11 in', w: 8.5, h: 11, unit: 'in' },
  { id: 'flyer-half', category: 'flyer', label: 'Half-page flyer', hint: '5.5 × 8.5 in, two per sheet', w: 5.5, h: 8.5, unit: 'in' },
  { id: 'card', category: 'card', label: 'Business card', hint: '3.5 × 2 in, front and back', w: 3.5, h: 2, unit: 'in', sides: 2 },
  { id: 'fridge', category: 'magnet', label: 'Fridge magnet', hint: '2.5 × 3.5 in', w: 2.5, h: 3.5, unit: 'in' },
  { id: 'truck', category: 'magnet', label: 'Truck door magnet', hint: '24 × 12 in', w: 24, h: 12, unit: 'in' },
  { id: 'yard', category: 'sign', label: 'Yard sign', hint: '24 × 18 in, coroplast', w: 24, h: 18, unit: 'in' },
];

export const BLEED_IN = 0.125;
const PT = 72; // SVG user units per inch for print formats

export interface PromoTopic {
  id: string;
  label: string;
}

/** What can be promoted right now, taken from the live site. */
export function promoTopics(p: BusinessProfile, now: Date): PromoTopic[] {
  const t: PromoTopic[] = [{ id: 'brand', label: 'Your business' }];
  if (p.special && isSpecialLive(p, now)) t.push({ id: 'special', label: `Deal: ${p.special.title}` });
  if (p.availability.kind === 'emergency') t.push({ id: 'emergency', label: 'Taking emergency calls' });
  for (const s of p.services) t.push({ id: `svc:${s.id}`, label: s.name });
  const job = [...p.jobs].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (job) t.push({ id: `job:${job.id}`, label: `Recent job: ${job.caption}` });
  if (p.towns.length > 1) t.push({ id: 'area', label: 'Towns you serve' });
  return t;
}

export interface PromoContent {
  eyebrow: string;
  head: string;
  sub: string;
  foot: string;
  photo?: string | null;
}

const townList = (p: BusinessProfile, n = 3) => {
  const t = p.towns.filter((x) => !isPostalArea(x));
  return t.slice(0, n).join(', ') + (t.length > n ? ' and nearby' : '');
};

export function promoContent(p: BusinessProfile, topic: string): PromoContent {
  const name = [p.brand.name, p.brand.tagline].filter(Boolean).join(' ');
  const serving = `Serving ${townList(p)}`;
  if (topic === 'special' && p.special) {
    return { eyebrow: 'Limited-time deal', head: p.special.title, sub: p.special.detail || 'Book before it ends.', foot: `Until ${fmtDate(p.special.ends)}` };
  }
  if (topic === 'emergency') {
    return { eyebrow: 'Emergency calls', head: 'No heat? No hot water? Call now.', sub: `${name} is taking emergency calls.`, foot: serving };
  }
  if (topic.startsWith('svc:')) {
    const s = p.services.find((x) => `svc:${x.id}` === topic) ?? p.services[0];
    if (s) return { eyebrow: name, head: s.name, sub: s.blurb || `${s.name} for homes and businesses.`, foot: serving, photo: s.photoUrl };
  }
  if (topic.startsWith('job:')) {
    const j = p.jobs.find((x) => `job:${x.id}` === topic);
    if (j) return { eyebrow: 'Just finished', head: j.caption, sub: j.town ? `Another job done in ${j.town}.` : 'Another job done right.', foot: serving, photo: j.photoUrl };
  }
  if (topic === 'area') {
    return { eyebrow: 'Where we work', head: `Based in ${p.city}`, sub: `Heating, cooling and plumbing across ${townList(p, 6)}.`, foot: p.towns.filter((x) => !isPostalArea(x)).join(' · ') };
  }
  return {
    eyebrow: p.copy.kicker,
    head: `${p.copy.headlineA} ${p.copy.headlineB}`.trim(),
    sub: p.copy.intro,
    foot: p.facts.yearFounded ? `In business since ${p.facts.yearFounded}` : serving,
  };
}

/** A ready-to-paste caption for social posts. */
export function socialCaption(p: BusinessProfile, c: PromoContent, siteUrl: string): string {
  const tags = p.towns
    .filter((t) => !isPostalArea(t))
    .slice(0, 3)
    .map((t) => '#' + t.replace(/[^A-Za-z]/g, ''))
    .join(' ');
  return `${c.head}${/[.!?]$/.test(c.head) ? '' : '.'}\n\n${c.sub}\n\nCall ${p.phone} or send a request at ${siteUrl.replace(/^https?:\/\//, '')}.\n\n${tags} #HVAC #Plumbing`;
}

// ---------- rendering ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap by an average character width (condensed bold ≈ 0.5em). */
export function wrap(text: string, maxWidth: number, fontSize: number, maxLines: number, charEm = 0.5): string[] {
  const perLine = Math.max(4, Math.floor(maxWidth / (fontSize * charEm)));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > perLine && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const keep = lines.slice(0, maxLines);
    keep[maxLines - 1] = keep[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    return keep;
  }
  return lines;
}

/** Biggest font size (≤ max) at which text fits in maxLines. */
export function fit(text: string, maxWidth: number, max: number, min: number, maxLines: number, charEm = 0.5): { size: number; lines: string[] } {
  for (let s = max; s >= min; s -= Math.max(1, Math.round(max / 40))) {
    const lines = wrap(text, maxWidth, s, 99, charEm);
    // a single long word (like a phone number) can't wrap, so check widths too
    if (lines.length <= maxLines && lines.every((l) => l.length * s * charEm <= maxWidth)) return { size: s, lines };
  }
  return { size: min, lines: wrap(text, maxWidth, min, maxLines, charEm) };
}

interface Palette {
  bg: string;
  fg: string;
  accent: string;
  onAccent: string;
  muted: string;
  primary: string;
}
/** Three looks per design: dark, light and bold. */
export function palette(p: BusinessProfile, variant: number): Palette {
  const { primary, accent, ink } = p.brand;
  if (variant === 1) return { bg: '#FFFFFF', fg: ink, accent: readable(primary), onAccent: '#FFFFFF', muted: mix(ink, '#FFFFFF', 0.4), primary };
  if (variant === 2) return { bg: accent, fg: onColour(accent), accent: ink, onAccent: onColour(ink), muted: mix(onColour(accent), accent, 0.3), primary };
  return { bg: ink, fg: '#FFFFFF', accent, onAccent: onColour(accent), muted: mix('#FFFFFF', ink, 0.35), primary };
}

const FONT = `font-family="Archivo, 'Archivo Narrow', 'Arial Narrow', Arial, sans-serif"`;

interface Ctx {
  p: BusinessProfile;
  c: PromoContent;
  pal: Palette;
  site: string;
  W: number;
  H: number;
}

function text(x: number, y: number, lines: string[], size: number, fill: string, opts: { weight?: number; anchor?: 'start' | 'middle' | 'end'; lh?: number; caps?: boolean; spacing?: number; stretch?: number } = {}): string {
  const lh = opts.lh ?? 1.02;
  return lines
    .map(
      (l, i) =>
        `<text x="${x.toFixed(1)}" y="${(y + i * size * lh).toFixed(1)}" ${FONT} font-size="${size.toFixed(1)}" font-weight="${opts.weight ?? 800}" fill="${fill}"${opts.anchor ? ` text-anchor="${opts.anchor}"` : ''}${opts.spacing ? ` letter-spacing="${opts.spacing}"` : ''}${opts.stretch ? ` font-stretch="${opts.stretch}%"` : ''}>${esc(opts.caps ? l.toUpperCase() : l)}</text>`,
    )
    .join('');
}

/** Logo if there is one, otherwise the name set in type. */
function brandMark(k: Ctx, x: number, y: number, h: number, maxW: number, fill: string): string {
  const { p } = k;
  if (p.brand.logoUrl) {
    // A white chip keeps any logo readable on dark backgrounds.
    const pad = h * 0.18;
    return `<rect x="${x}" y="${y}" width="${maxW}" height="${h}" rx="${h * 0.18}" fill="#FFFFFF"/><image href="${esc(p.brand.logoUrl)}" x="${x + pad}" y="${y + pad}" width="${maxW - 2 * pad}" height="${h - 2 * pad}" preserveAspectRatio="xMinYMid meet"/>`;
  }
  const size = h * 0.56;
  const name = fit(p.brand.name.toUpperCase(), maxW, size, size * 0.4, 1, 0.68);
  return (
    text(x, y + h * 0.58, name.lines, name.size, fill, { weight: 900, stretch: 80 }) +
    (p.brand.tagline ? text(x, y + h * 0.58 + h * 0.36, [p.brand.tagline.toUpperCase()], h * 0.2, k.pal.accent === fill ? k.pal.fg : k.pal.accent, { weight: 700, spacing: h * 0.03 }) : '')
  );
}

const phoneIcon = (x: number, y: number, s: number, fill: string) =>
  `<g transform="translate(${x} ${y}) scale(${s / 24})"><path fill="${fill}" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></g>`;

function photoOrArt(k: Ctx, x: number, y: number, w: number, h: number, r: number): string {
  const id = `clip${Math.round(x)}${Math.round(y)}`;
  if (k.c.photo) {
    return `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath><image href="${esc(k.c.photo)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
  }
  // Abstract dial arcs in brand colours (no stock photos).
  const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) / 2;
  let ticks = '';
  for (let i = 0; i <= 30; i++) {
    const a = ((-210 + i * 8) * Math.PI) / 180;
    const r1 = R * (i % 5 ? 0.86 : 0.8), r2 = R * 0.94;
    ticks += `<line x1="${(cx + r1 * Math.cos(a)).toFixed(1)}" y1="${(cy + r1 * Math.sin(a)).toFixed(1)}" x2="${(cx + r2 * Math.cos(a)).toFixed(1)}" y2="${(cy + r2 * Math.sin(a)).toFixed(1)}" stroke="${i > 20 ? k.p.brand.accent : mix(k.p.brand.primary, '#FFFFFF', 0.35)}" stroke-width="${R * (i % 5 ? 0.012 : 0.022)}" stroke-linecap="round"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${mix(k.p.brand.primary, k.pal.bg, 0.55)}" opacity=".35"/>${ticks}<circle cx="${cx}" cy="${cy}" r="${R * 0.62}" fill="${k.pal.bg === '#FFFFFF' ? mix(k.p.brand.primary, '#FFFFFF', 0.88) : mix(k.p.brand.ink, '#FFFFFF', 0.08)}"/>`;
}

function callBar(k: Ctx, x: number, y: number, w: number, h: number, label = 'Call'): string {
  const { pal, p } = k;
  const size = h * 0.46;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h * 0.22}" fill="${pal.accent}"/>${phoneIcon(x + h * 0.3, y + h * 0.27, h * 0.46, pal.onAccent)}${text(x + h * 0.95, y + h * 0.66, [`${label} ${p.phone}`], size, pal.onAccent, { weight: 850 })}`;
}

// ----- one function per format -----

function social(k: Ctx, kind: 'post' | 'story' | 'carousel', slide = 0): string {
  const { W, H, pal, c, p } = k;
  const m = W * 0.07;
  let out = `<rect width="${W}" height="${H}" fill="${pal.bg}"/>`;
  out += brandMark(k, m, m, W * 0.09, W * 0.42, pal.fg);
  if (kind === 'carousel' && slide === 1) {
    out += text(m, H * 0.26, ['WHAT WE DO'], W * 0.035, pal.accent, { weight: 750, spacing: 4 });
    p.services.slice(0, 4).forEach((s, i) => {
      const y = H * 0.33 + i * H * 0.13;
      out += text(m, y, [String(i + 1).padStart(2, '0')], W * 0.04, pal.accent, { weight: 800 });
      out += text(m + W * 0.12, y, fit(s.name.toUpperCase(), W - 2 * m - W * 0.12, W * 0.07, W * 0.045, 1, 0.64).lines, W * 0.07, pal.fg, { weight: 900, stretch: 80 });
    });
  } else if (kind === 'carousel' && slide === 2) {
    out += text(m, H * 0.3, ['WHERE WE WORK'], W * 0.035, pal.accent, { weight: 750, spacing: 4 });
    const head = fit(`Based in ${p.city}`.toUpperCase(), W - 2 * m, W * 0.11, W * 0.06, 2, 0.64);
    out += text(m, H * 0.4, head.lines, head.size, pal.fg, { weight: 900, stretch: 80, lh: 0.95 });
    const towns = wrap(p.towns.filter((t) => !isPostalArea(t)).join(' · '), W - 2 * m, W * 0.042, 5, 0.54);
    out += text(m, H * 0.6, towns, W * 0.042, pal.muted, { weight: 600, lh: 1.4 });
  } else if (kind === 'carousel' && slide === 3) {
    out += text(m, H * 0.36, [`CALL ${p.brand.name.toUpperCase()}`], W * 0.04, pal.accent, { weight: 750, spacing: 3 });
    const ph = fit(p.phone, W - 2 * m, W * 0.16, W * 0.08, 1, 0.62);
    out += text(m, H * 0.36 + ph.size * 1.1, ph.lines, ph.size, pal.fg, { weight: 900, stretch: 80 });
    out += text(m, H * 0.62, [`or send a request at ${k.site}`], W * 0.036, pal.muted, { weight: 600 });
  } else {
    const artH = kind === 'story' ? H * 0.34 : H * 0.3;
    const artY = kind === 'story' ? H * 0.12 : H * 0.15;
    out += photoOrArt(k, c.photo ? m : W - m - artH, artY, c.photo ? W - 2 * m : artH, artH, W * 0.03);
    const y0 = artY + artH + H * 0.07;
    out += text(m, y0, [c.eyebrow.toUpperCase()], W * 0.032, pal.accent, { weight: 750, spacing: 4 });
    const head = fit(c.head.toUpperCase(), W - 2 * m, W * (kind === 'story' ? 0.11 : 0.09), W * 0.05, kind === 'story' ? 3 : 2, 0.64);
    out += text(m, y0 + head.size * 1.05, head.lines, head.size, pal.fg, { weight: 900, stretch: 80, lh: 0.95 });
    const subY = y0 + head.size * (1.05 + (head.lines.length - 1) * 0.95) + W * 0.065;
    const room = Math.floor((H - m - W * 0.11 - W * 0.04 - subY) / (W * 0.036 * 1.35)) + 1;
    if (room > 0) out += text(m, subY, wrap(c.sub, W - 2 * m, W * 0.036, Math.min(room, kind === 'story' ? 4 : 2), 0.54), W * 0.036, pal.muted, { weight: 500, lh: 1.35 });
    if (kind === 'carousel') out += text(W - m, m + W * 0.06, ['Swipe →'], W * 0.03, pal.muted, { weight: 700, anchor: 'end' });
  }
  out += callBar(k, m, H - m - W * 0.11, W - 2 * m, W * 0.11);
  return out;
}

function flyer(k: Ctx, half: boolean): string {
  const { W, H, pal, c, p } = k;
  const m = W * 0.08;
  const barH = W * (half ? 0.14 : 0.12);
  const barY = H - m - barH - W * 0.05;
  let out = `<rect width="${W}" height="${H}" fill="${pal.bg}"/>`;
  out += brandMark(k, m, m, W * 0.11, W * 0.5, pal.fg);
  const artH = H * (half ? 0.22 : 0.24);
  out += photoOrArt(k, c.photo ? m : W / 2 - artH / 2, H * 0.14, c.photo ? W - 2 * m : artH, artH, W * 0.025);
  let y = H * 0.14 + artH + W * 0.1;
  out += text(m, y, [c.eyebrow.toUpperCase()], W * 0.03, pal.accent, { weight: 750, spacing: 3 });
  const head = fit(c.head.toUpperCase(), W - 2 * m, W * 0.1, W * 0.055, 2, 0.64);
  y += head.size * 1.05;
  out += text(m, y, head.lines, head.size, pal.fg, { weight: 900, stretch: 80, lh: 0.95 });
  y += head.size * 0.95 * (head.lines.length - 1) + W * 0.065;
  const sub = wrap(c.sub, W - 2 * m, W * 0.032, half ? 2 : 3, 0.54);
  out += text(m, y, sub, W * 0.032, pal.muted, { weight: 500, lh: 1.35 });
  y += W * 0.032 * 1.35 * sub.length + W * 0.06;
  if (!half) {
    const rowH = W * 0.055;
    const rows = Math.max(0, Math.min(3, Math.floor((barY - W * 0.08 - y) / rowH)));
    const svcs = p.services.slice(0, rows * 2);
    svcs.forEach((s, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = m + (col * (W - 2 * m)) / 2;
      out += `<circle cx="${x + W * 0.012}" cy="${y + row * rowH - W * 0.011}" r="${W * 0.009}" fill="${pal.accent}"/>`;
      out += text(x + W * 0.035, y + row * rowH, wrap(s.name, (W - 2 * m) / 2 - W * 0.05, W * 0.03, 1, 0.56), W * 0.03, pal.fg, { weight: 700 });
    });
    y += Math.ceil(svcs.length / 2) * rowH + W * 0.01;
    if (y < barY - W * 0.05) out += text(m, y, wrap(`Serving ${p.towns.filter((t) => !isPostalArea(t)).join(', ')}`, W - 2 * m, W * 0.026, 1, 0.54), W * 0.026, pal.muted, { weight: 600 });
  }
  out += callBar(k, m, barY, W - 2 * m, barH);
  out += text(W / 2, H - m, [`${c.foot} · ${k.site}`], W * 0.024, pal.muted, { weight: 600, anchor: 'middle' });
  return out;
}

function card(k: Ctx, side: 0 | 1): string {
  const { W, H, pal, p } = k;
  const m = H * 0.12;
  if (side === 0) {
    return `<rect width="${W}" height="${H}" fill="${pal.bg}"/>${brandMark(k, m, H * 0.26, H * 0.34, W * 0.66, pal.fg)}<rect x="0" y="${H - H * 0.07}" width="${W}" height="${H * 0.07}" fill="${pal.accent}"/>`;
  }
  const light = palette(p, 1);
  let out = `<rect width="${W}" height="${H}" fill="${light.bg}"/>`;
  out += text(m, H * 0.26, [[p.brand.name, p.brand.tagline].filter(Boolean).join(' ').toUpperCase()], H * 0.085, light.fg, { weight: 900, stretch: 80 });
  out += text(m, H * 0.37, [p.copy.kicker], H * 0.06, light.accent, { weight: 650 });
  out += phoneIcon(m, H * 0.5, H * 0.1, light.accent);
  out += text(m + H * 0.15, H * 0.59, [p.phone], H * 0.11, light.fg, { weight: 850 });
  out += text(m, H * 0.74, [k.site], H * 0.065, light.muted, { weight: 600 });
  if (p.email) out += text(m, H * 0.85, [p.email], H * 0.06, light.muted, { weight: 500 });
  out += `<rect x="${W - H * 0.07}" y="0" width="${H * 0.07}" height="${H}" fill="${p.brand.accent}"/>`;
  return out;
}

function fridge(k: Ctx): string {
  const { W, H, pal, p } = k;
  const m = W * 0.1;
  let out = `<rect width="${W}" height="${H}" fill="${pal.bg}"/>`;
  out += brandMark(k, m, m, W * 0.22, W - 2 * m, pal.fg);
  const q = fit('NO HEAT? NO HOT WATER?', W - 2 * m, W * 0.075, W * 0.04, 2, 0.64);
  out += text(m, H * 0.36, q.lines, q.size, pal.accent, { weight: 800, lh: 1.1 });
  out += text(m, H * 0.36 + q.size * 1.1 * q.lines.length, ['KEEP THIS NUMBER HANDY'], W * 0.048, pal.muted, { weight: 700 });
  const ph = fit(p.phone, W - 2 * m, W * 0.16, W * 0.1, 1, 0.62);
  out += `<rect x="${m * 0.6}" y="${H * 0.54}" width="${W - m * 1.2}" height="${ph.size * 1.7}" rx="${W * 0.04}" fill="${pal.accent}"/>`;
  out += text(W / 2, H * 0.54 + ph.size * 1.2, ph.lines, ph.size, pal.onAccent, { weight: 900, anchor: 'middle', stretch: 85 });
  const svc = p.services.slice(0, 3).map((s) => s.name).join(' · ');
  out += text(W / 2, H * 0.84, wrap(svc, W - 2 * m, W * 0.048, 2, 0.5), W * 0.048, pal.fg, { weight: 650, anchor: 'middle', lh: 1.3 });
  out += text(W / 2, H - m * 0.7, [k.site], W * 0.045, pal.muted, { weight: 600, anchor: 'middle' });
  return out;
}

function truck(k: Ctx): string {
  const { W, H, pal, p } = k;
  const m = H * 0.1;
  let out = `<rect width="${W}" height="${H}" rx="${H * 0.06}" fill="${pal.bg}"/>`;
  out += brandMark(k, m, m, H * 0.3, W * 0.55, pal.fg);
  out += text(m, H * 0.56, [p.copy.kicker.toUpperCase()], H * 0.075, pal.accent, { weight: 750, spacing: 2 });
  const ph = fit(p.phone, W - 2 * m, H * 0.24, H * 0.14, 1, 0.62);
  out += text(m, H * 0.84, ph.lines, ph.size, pal.fg, { weight: 900, stretch: 85 });
  out += text(W - m, m + H * 0.08, [k.site], H * 0.055, pal.muted, { weight: 650, anchor: 'end' });
  return out;
}

function yard(k: Ctx): string {
  const { W, H, pal, p } = k;
  const m = H * 0.08;
  let out = `<rect width="${W}" height="${H}" fill="${pal.bg}"/>`;
  out += brandMark(k, m, m, H * 0.2, W * 0.6, pal.fg);
  const kick = fit(p.copy.kicker.toUpperCase(), W - 2 * m, H * 0.1, H * 0.06, 1, 0.64);
  out += text(m, H * 0.44, kick.lines, kick.size, pal.fg, { weight: 900, stretch: 80 });
  const barH = H * 0.3;
  out += text(m, H - barH - m - H * 0.04, ['PROUDLY WORKING IN YOUR NEIGHBOURHOOD'], H * 0.042, pal.accent, { weight: 800, spacing: 2 });
  out += `<rect x="0" y="${H - barH - m}" width="${W}" height="${barH}" fill="${pal.accent}"/>`;
  const ph = fit(p.phone, W - 2 * m, barH * 0.62, barH * 0.4, 1, 0.62);
  out += text(W / 2, H - m - barH / 2 + ph.size * 0.36, ph.lines, ph.size, pal.onAccent, { weight: 900, anchor: 'middle', stretch: 85 });
  out += text(W / 2, H - m * 0.35, [k.site], H * 0.045, pal.muted, { weight: 650, anchor: 'middle' });
  return out;
}

export interface RenderOpts {
  topic: string;
  variant: number;
  siteUrl: string;
  slide?: number;
  side?: 0 | 1;
  /** Print: add bleed and crop marks. */
  print?: boolean;
  /** Override words the owner edited on the preview. */
  content?: Partial<PromoContent>;
}

/** Render one design to an SVG string. */
export function renderPromo(p: BusinessProfile, formatId: string, o: RenderOpts): string {
  const f = FORMATS.find((x) => x.id === formatId);
  if (!f) throw new Error('Unknown format');
  const W = f.unit === 'in' ? f.w * PT : f.w;
  const H = f.unit === 'in' ? f.h * PT : f.h;
  const c = { ...promoContent(p, o.topic), ...(o.content ?? {}) };
  const k: Ctx = { p, c, pal: palette(p, o.variant), site: o.siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''), W, H };
  let body: string;
  switch (f.id) {
    case 'post':
    case 'story':
      body = social(k, f.id);
      break;
    case 'carousel':
      body = social(k, 'carousel', o.slide ?? 0);
      break;
    case 'flyer-letter':
    case 'flyer-half':
      body = flyer(k, f.id === 'flyer-half');
      break;
    case 'card':
      body = card(k, o.side ?? 0);
      break;
    case 'fridge':
      body = fridge(k);
      break;
    case 'truck':
      body = truck(k);
      break;
    case 'yard':
      body = yard(k);
      break;
    default:
      throw new Error('Unknown format');
  }
  const title = `<title>${esc(`${p.brand.name} · ${f.label}`)}</title>`;
  if (f.unit === 'px' || !o.print) {
    const size = f.unit === 'in' ? `width="${f.w}in" height="${f.h}in"` : `width="${W}" height="${H}"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${size} viewBox="0 0 ${W} ${H}">${title}${body}</svg>`;
  }
  // Print: extend the background 1/8" past the trim on every side (what print shops ask for).
  const b = BLEED_IN * PT;
  const bg = body.match(/^<rect width="[\d.]+" height="[\d.]+"(?: rx="[\d.]+")? fill="([^"]+)"\/>/)?.[1] ?? '#FFFFFF';
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${f.w + 2 * BLEED_IN}in" height="${f.h + 2 * BLEED_IN}in" viewBox="${-b} ${-b} ${W + 2 * b} ${H + 2 * b}">${title}<rect x="${-b}" y="${-b}" width="${W + 2 * b}" height="${H + 2 * b}" fill="${bg}"/>${body}</svg>`;
}

/** Number of pictures a design produces (carousel slides, card sides). */
export function pageCount(formatId: string): number {
  const f = FORMATS.find((x) => x.id === formatId);
  return f?.slides ?? f?.sides ?? 1;
}
