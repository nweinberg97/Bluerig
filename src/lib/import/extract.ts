// Fact-finding from a shop's existing website. Pure functions over already-fetched
// page text, so it's fully testable. Everything found keeps a note of where it came
// from, and anything uncertain becomes a "confirm" item for the owner.

import type { DayHours, PriceItem, ServiceIcon, WeekHours } from '../profile';
import { DAYS, digits, emptyHours, formatPhone } from '../profile';
import { findTowns, PROVINCES } from '../places-ca';

export interface PageText {
  url: string;
  title: string;
  metaDescription: string;
  ogSiteName: string;
  ogImage: string;
  themeColor: string;
  headings: string[];
  text: string;
  telLinks: string[];
  mailLinks: string[];
  links: { href: string; text: string }[];
  logoCandidates: { src: string; score: number }[];
  /** Colours found in inline styles and the first stylesheets, with how often. */
  colours: Record<string, number>;
}

export interface Found<T> {
  value: T;
  source: string; // url, plus a short quote when useful
  sure: boolean;
}

export interface Extracted {
  name?: Found<string>;
  tagline?: Found<string>;
  phone?: Found<string>;
  email?: Found<string>;
  city?: Found<string>;
  province?: Found<string>;
  towns?: Found<string[]>;
  services: Found<{ name: string; blurb: string; icon: ServiceIcon }>[];
  hours?: Found<WeekHours>;
  emergency247?: Found<boolean>;
  yearFounded?: Found<number>;
  licensedInsured?: Found<boolean>;
  familyOwned?: Found<boolean>;
  prices: Found<PriceItem>[];
  logoUrl?: Found<string>;
  colours?: Found<{ primary: string; accent: string; ink: string }>;
  reviewsUrl?: Found<string>;
  bookingUrl?: Found<string>;
}

const quote = (s: string, max = 90) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
};

// ---------- name ----------

const GENERIC = /^(home|welcome|homepage|index|contact( us)?|about( us)?|services?)$/i;

export function guessName(pages: PageText[]): Found<string> | undefined {
  const home = pages[0];
  if (!home) return undefined;
  if (home.ogSiteName && home.ogSiteName.length <= 40) return { value: home.ogSiteName.trim(), source: `${home.url} (site name)`, sure: true };
  const parts = home.title
    .split(/\s[|–—\-:•·]\s|\s\|\s|\|/)
    .map((s) => s.trim())
    .filter((s) => s && !GENERIC.test(s));
  // The segment that also appears on other pages' titles is usually the brand.
  const others = pages.slice(1).map((p) => p.title.toLowerCase());
  const shared = parts.find((s) => others.some((o) => o.includes(s.toLowerCase())));
  const pick = shared ?? parts.sort((a, b) => a.length - b.length)[0];
  return pick && pick.length <= 60 ? { value: pick, source: `${home.url} (page title)`, sure: !!shared } : undefined;
}

/** "Greenway Mechanical Ltd." → name "Greenway", tagline "Mechanical". */
export function splitName(full: string): { name: string; tagline: string } {
  const clean = full.replace(/\b(ltd|inc|corp|co|llc|limited|incorporated)\.?$/i, '').replace(/[,.\s]+$/, '').trim();
  const m = clean.match(/^(.+?)\s+((?:Mechanical|Plumbing|Heating|HVAC|Heating & Cooling|Heating and Cooling|Plumbing & Heating|Plumbing and Heating|Air|Comfort|Services|Gas|Climate|Energy|Home Services)(?:\s.*)?)$/i);
  if (m && m[1].length >= 2) return { name: m[1].slice(0, 40), tagline: m[2].slice(0, 30) };
  return { name: clean.slice(0, 40), tagline: '' };
}

// ---------- phone / email ----------

const PHONE = /(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g;

export function findPhone(pages: PageText[]): Found<string> | undefined {
  for (const p of pages) {
    const tel = p.telLinks.map((t) => digits(t).replace(/^1(?=\d{10}$)/, '')).find((d) => d.length === 10);
    if (tel) return { value: formatPhone(tel), source: `${p.url} (call link)`, sure: true };
  }
  const counts = new Map<string, { n: number; url: string }>();
  for (const p of pages) {
    for (const m of p.text.matchAll(PHONE)) {
      const d = m[1] + m[2] + m[3];
      const c = counts.get(d) ?? { n: 0, url: p.url };
      c.n++;
      counts.set(d, c);
    }
  }
  const best = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0];
  return best ? { value: formatPhone(best[0]), source: best[1].url, sure: best[1].n > 1 } : undefined;
}

export function findEmail(pages: PageText[]): Found<string> | undefined {
  for (const p of pages) {
    const m = p.mailLinks.map((x) => x.replace(/^mailto:/i, '').split('?')[0].trim()).find((x) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(x));
    if (m) return { value: m.toLowerCase(), source: `${p.url} (email link)`, sure: true };
  }
  for (const p of pages) {
    const m = p.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (m && !/example|sentry|wixpress|domain\.com/i.test(m[0])) return { value: m[0].toLowerCase(), source: p.url, sure: false };
  }
  return undefined;
}

// ---------- location ----------

const POSTAL_PROV: Record<string, string> = {
  A: 'NL', B: 'NS', C: 'PE', E: 'NB', G: 'QC', H: 'QC', J: 'QC', K: 'ON', L: 'ON', M: 'ON', N: 'ON', P: 'ON',
  R: 'MB', S: 'SK', T: 'AB', V: 'BC', Y: 'YT',
};

export function findLocation(pages: PageText[]): { city?: Found<string>; province?: Found<string>; towns?: Found<string[]> } {
  const all = pages.map((p) => p.text).join('\n');
  let province: Found<string> | undefined;
  const pc = all.match(/\b([ABCEGHJ-NPRSTVXY])\d[A-Z]\s?\d[A-Z]\d\b/);
  if (pc && POSTAL_PROV[pc[1]]) province = { value: POSTAL_PROV[pc[1]], source: `postal code ${pc[0]}`, sure: true };
  if (!province) {
    const abbr = all.match(/,\s*(BC|AB|SK|MB|ON|QC|NB|NS|PE|NL|YT|NT|NU)\b/);
    if (abbr) province = { value: abbr[1], source: `“${quote(abbr[0])}”`, sure: true };
    else {
      const full = Object.entries(PROVINCES).find(([, n]) => all.includes(n));
      if (full) province = { value: full[0], source: `mentions ${full[1]}`, sure: false };
    }
  }
  const towns = findTowns(all, province?.value);
  // City: the town right before a province or postal code (the address), else the most-mentioned.
  let city: Found<string> | undefined;
  const addr = all.match(/([A-Z][A-Za-z.'\- ]{2,30}),?\s*(?:BC|AB|SK|MB|ON|QC|NB|NS|PE|NL|British Columbia|Alberta|Ontario|Quebec)\b/);
  if (addr) {
    const t = findTowns(addr[1]).pop();
    if (t) city = { value: t, source: `address “${quote(addr[0])}”`, sure: true };
  }
  if (!city && towns.length) {
    const freq = towns.map((t) => ({ t, n: all.split(t).length - 1 })).sort((a, b) => b.n - a.n);
    city = { value: freq[0].t, source: 'most-mentioned town', sure: false };
  }
  return {
    city,
    province,
    towns: towns.length ? { value: towns.slice(0, 20), source: 'towns named on the site', sure: false } : undefined,
  };
}

// ---------- services ----------

const SERVICE_KEYS: { re: RegExp; name: string; icon: ServiceIcon }[] = [
  { re: /\bfurnaces?\b/i, name: 'Furnaces', icon: 'flame' },
  { re: /\bheat pumps?\b/i, name: 'Heat pumps', icon: 'pump' },
  { re: /\bair condition(ing|ers?)\b|\bA\/C\b|\bcentral air\b/i, name: 'Air conditioning', icon: 'snow' },
  { re: /\bductless\b|\bmini[- ]splits?\b/i, name: 'Ductless mini-splits', icon: 'fan' },
  { re: /\bboilers?\b|\bhydronic\b/i, name: 'Boilers & hydronic heating', icon: 'flame' },
  { re: /\bradiant (floor )?heat/i, name: 'Radiant floor heating', icon: 'flame' },
  { re: /\btankless\b|\bon[- ]demand water/i, name: 'Tankless water heaters', icon: 'drop' },
  { re: /\bhot water tanks?\b|\bwater heaters?\b/i, name: 'Hot water tanks', icon: 'drop' },
  { re: /\bdrain(s| cleaning)\b|\bclogged\b|\bdrain clearing\b/i, name: 'Drain cleaning', icon: 'pipe' },
  { re: /\bsewer\b|\bcamera inspection\b/i, name: 'Sewer & camera inspection', icon: 'pipe' },
  { re: /\bplumbing (repairs?|services?)\b|\bleaks?\b|\bfaucets?\b|\btoilets?\b/i, name: 'Plumbing repairs', icon: 'wrench' },
  { re: /\bgas ?fitting\b|\bgas lines?\b/i, name: 'Gas fitting', icon: 'flame' },
  { re: /\bfireplaces?\b/i, name: 'Gas fireplaces', icon: 'flame' },
  { re: /\bHRV\b|\bERV\b|\bventilation\b/i, name: 'Ventilation (HRV/ERV)', icon: 'fan' },
  { re: /\bduct (cleaning|work)\b|\bductwork\b/i, name: 'Ductwork', icon: 'fan' },
  { re: /\bbackflow\b/i, name: 'Backflow testing', icon: 'pipe' },
  { re: /\bsump pumps?\b/i, name: 'Sump pumps', icon: 'pump' },
  { re: /\bcommercial\b.{0,30}\b(hvac|heating|plumbing|refrigeration|rooftop)\b|\brooftop units?\b|\bRTUs?\b/i, name: 'Commercial HVAC', icon: 'building' },
  { re: /\bmaintenance (plans?|program|agreements?)\b|\btune[- ]ups?\b/i, name: 'Maintenance plans', icon: 'wrench' },
];

/** The site's own sentence about a service, if there's a short one. Never written by us. */
function ownSentence(text: string, re: RegExp): string {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim());
  const s = sentences.find((x) => re.test(x) && x.length >= 30 && x.length <= 140 && !/\$|call now|click|cookie/i.test(x));
  return s ?? '';
}

export function findServices(pages: PageText[]): Found<{ name: string; blurb: string; icon: ServiceIcon }>[] {
  const out: Found<{ name: string; blurb: string; icon: ServiceIcon }>[] = [];
  for (const k of SERVICE_KEYS) {
    const page = pages.find((p) => k.re.test(p.headings.join('\n'))) ?? pages.find((p) => k.re.test(p.text));
    if (!page) continue;
    const inHeading = k.re.test(page.headings.join('\n'));
    const hits = pages.reduce((n, p) => n + (p.text.match(new RegExp(k.re.source, 'gi'))?.length ?? 0), 0);
    if (!inHeading && hits < 2) continue; // one passing mention isn't a service
    out.push({ value: { name: k.name, blurb: ownSentence(page.text, k.re), icon: k.icon }, source: page.url, sure: inHeading });
  }
  // Hot water tanks and tankless overlap; keep both only if both are clearly there.
  return out.slice(0, 8);
}

// ---------- hours ----------

const DAY_RE = '(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\\.?';
const TIME_RE = '(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?';

function hourOf(h: string, m: string | undefined, ap: string | undefined, fallbackPm: boolean): number {
  let n = Number(h) % 12;
  const pm = ap ? /p/i.test(ap) : fallbackPm;
  if (pm) n += 12;
  return n + (m ? Number(m) / 60 : 0);
}
const dayIdx = (s: string) => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(s.slice(0, 3).toLowerCase());

export function findHours(pages: PageText[]): Found<WeekHours> | undefined {
  const re = new RegExp(`${DAY_RE}(?:\\s*(?:-|–|to|through)\\s*${DAY_RE})?\\s*:?\\s*(?:${TIME_RE}\\s*(?:-|–|to)\\s*${TIME_RE}|(closed))`, 'gi');
  for (const p of pages) {
    const h: WeekHours = emptyHours();
    let any = false;
    const quotes: string[] = [];
    for (const m of p.text.matchAll(re)) {
      const a = dayIdx(m[1]);
      const b = m[2] ? dayIdx(m[2]) : a;
      if (a < 0 || b < 0) continue;
      let val: DayHours = null;
      if (!m[9]) {
        const open = hourOf(m[3], m[4], m[5], false);
        const close = hourOf(m[6], m[7], m[8], true);
        if (!(open < close && close <= 24)) continue;
        val = [open, close];
      }
      for (let i = a; ; i = (i + 1) % 7) {
        h[DAYS[i]] = val;
        if (i === b) break;
      }
      any = true;
      quotes.push(quote(m[0], 40));
    }
    if (any) return { value: h, source: `${p.url} (“${quotes.slice(0, 2).join('; ')}”)`, sure: true };
  }
  return undefined;
}

// ---------- facts (always confirmed by the owner, never assumed) ----------

export function findFacts(pages: PageText[]) {
  const all = pages.map((p) => p.text).join('\n');
  const src = (re: RegExp) => {
    const p = pages.find((x) => re.test(x.text));
    const m = p?.text.match(re);
    return p && m ? `${p.url} (“${quote(m[0], 60)}”)` : '';
  };
  const out: Pick<Extracted, 'emergency247' | 'yearFounded' | 'licensedInsured' | 'familyOwned'> = {};
  const e = /\b24\s?\/\s?7\b|\b24 hours? (a day|emergency)|\bemergency service\b/i;
  if (e.test(all)) out.emergency247 = { value: true, source: src(e), sure: false };
  const y = /\b(?:since|established(?: in)?|est\.?|founded(?: in)?|serving [^.]{0,40} since)\s*(19[5-9]\d|20[0-2]\d)\b/i;
  const ym = all.match(y);
  if (ym) out.yearFounded = { value: Number(ym[1]), source: src(y), sure: false };
  const l = /\blicen[cs]ed\b[^.]{0,30}\binsured\b|\binsured\b[^.]{0,30}\blicen[cs]ed\b/i;
  if (l.test(all)) out.licensedInsured = { value: true, source: src(l), sure: false };
  const f = /\bfamily[- ](owned|run|operated)\b/i;
  if (f.test(all)) out.familyOwned = { value: true, source: src(f), sure: false };
  return out;
}

export function findPrices(pages: PageText[]): Found<PriceItem>[] {
  const re = /\b(diagnostic|service call|call[- ]out|trip|dispatch|inspection|assessment)\s*(fee|charge|rate)?[^$\n.]{0,20}\$\s?(\d{2,4})(?:\.\d{2})?/gi;
  const seen = new Set<string>();
  const out: Found<PriceItem>[] = [];
  for (const p of pages) {
    for (const m of p.text.matchAll(re)) {
      const label = `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()} ${(m[2] ?? 'fee').toLowerCase()}`;
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ value: { id: `imp${out.length}`, label, amount: Number(m[3]) }, source: `${p.url} (“${quote(m[0], 60)}”)`, sure: false });
    }
  }
  return out.slice(0, 4);
}

// ---------- brand ----------

export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function normalizeHex(c: string): string | null {
  const t = c.trim().toLowerCase();
  let m = t.match(/^#([0-9a-f]{3})$/);
  if (m) return '#' + m[1].split('').map((x) => x + x).join('').toUpperCase();
  m = t.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/);
  if (m) return '#' + m[1].toUpperCase();
  m = t.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
  if (m) return '#' + [m[1], m[2], m[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('').toUpperCase();
  return null;
}

/** Pick brand colours: the most-used saturated colour, a second distinct hue, and a dark ink. */
export function pickColours(counts: Record<string, number>, themeColor?: string): { primary: string; accent: string; ink: string } | null {
  const tally = new Map<string, number>();
  for (const [c, n] of Object.entries(counts)) {
    const h = normalizeHex(c);
    if (h) tally.set(h, (tally.get(h) ?? 0) + n);
  }
  const theme = themeColor ? normalizeHex(themeColor) : null;
  if (theme) tally.set(theme, (tally.get(theme) ?? 0) + 50);
  const colourful = [...tally.entries()]
    .map(([hex, n]) => ({ hex, n, hsl: hexToHsl(hex) }))
    .filter((c) => c.hsl[1] > 0.35 && c.hsl[2] > 0.18 && c.hsl[2] < 0.75)
    .sort((a, b) => b.n - a.n);
  if (!colourful.length) return null;
  const primary = colourful[0];
  const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  const accent = colourful.find((c) => hueGap(c.hsl[0], primary.hsl[0]) > 40) ?? null;
  const darks = [...tally.keys()].map((hex) => ({ hex, hsl: hexToHsl(hex) })).filter((c) => c.hsl[2] < 0.2 && c.hsl[2] > 0.03);
  const ink = darks.sort((a, b) => b.hsl[1] - a.hsl[1])[0]?.hex ?? '#14202B';
  return { primary: primary.hex, accent: accent?.hex ?? '#F7A928', ink };
}

export function findLogo(pages: PageText[]): Found<string> | undefined {
  const home = pages[0];
  if (!home) return undefined;
  const best = [...home.logoCandidates].sort((a, b) => b.score - a.score)[0];
  if (best && best.score >= 2) return { value: best.src, source: `${home.url} (logo image)`, sure: best.score >= 4 };
  return undefined;
}

// ---------- links ----------

const BOOKING = /housecallpro|jobber|servicetitan|getjobber|calendly|booknow|schedule|book online|book now|setmore|square\.site\/book/i;

export function findLinks(pages: PageText[]): Pick<Extracted, 'reviewsUrl' | 'bookingUrl'> {
  const links = pages.flatMap((p) => p.links.map((l) => ({ ...l, page: p.url })));
  const rv = links.find((l) => /g\.page\/|maps\.app\.goo\.gl|google\.[a-z.]+\/maps|search\.google\.com\/local\/writereview/i.test(l.href));
  const bk = links.find((l) => /^https?:/i.test(l.href) && BOOKING.test(l.href + ' ' + l.text) && !/facebook|instagram/i.test(l.href));
  return {
    reviewsUrl: rv ? { value: rv.href, source: rv.page, sure: true } : undefined,
    bookingUrl: bk ? { value: bk.href, source: bk.page, sure: false } : undefined,
  };
}

/** Run every finder. */
export function extractAll(pages: PageText[]): Extracted {
  const loc = findLocation(pages);
  const colours = pages[0] ? pickColours(Object.assign({}, ...pages.map((p) => p.colours)), pages[0].themeColor) : null;
  const fullName = guessName(pages);
  const split = fullName ? splitName(fullName.value) : null;
  return {
    name: fullName && split ? { ...fullName, value: split.name } : undefined,
    tagline: fullName && split?.tagline ? { ...fullName, value: split.tagline } : undefined,
    phone: findPhone(pages),
    email: findEmail(pages),
    ...loc,
    services: findServices(pages),
    hours: findHours(pages),
    ...findFacts(pages),
    prices: findPrices(pages),
    logoUrl: findLogo(pages),
    colours: colours ? { value: colours, source: `${pages[0].url} (site colours)`, sure: false } : undefined,
    ...findLinks(pages),
  };
}
