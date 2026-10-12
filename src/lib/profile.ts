// The business profile: one structured record that the website (and later the Google
// listing, posts and flyers) is generated from. Owners edit facts, never page layout,
// which is what keeps the design from breaking. No external dependencies on purpose.

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Day = (typeof DAYS)[number];
/** Opening and closing hour as decimals (8.5 = 8:30am). null = closed. */
export type DayHours = [number, number] | null;
export type WeekHours = Record<Day, DayHours>;

export interface Service {
  id: string;
  name: string;
  blurb: string;
  photoUrl?: string | null;
  icon?: ServiceIcon;
  /** The owner confirmed they have the rights to the photo. */
  photoRights?: boolean;
}
export type ServiceIcon = 'flame' | 'snow' | 'fan' | 'wrench' | 'building' | 'pump' | 'drop' | 'pipe';

export interface Override {
  id: string;
  from: string; // YYYY-MM-DD (local date)
  to: string; // YYYY-MM-DD, inclusive
  closed: boolean;
  open?: number;
  close?: number;
  label?: string;
}

export interface Special {
  title: string;
  detail?: string;
  ends: string; // YYYY-MM-DD, inclusive. Required: specials always take themselves down.
}

export interface Availability {
  kind: 'normal' | 'booked' | 'emergency';
  until: string | null; // ISO timestamp; required unless kind is normal
}

/** A line on the price list, e.g. "Diagnostic fee" $119. amount in dollars; null = "Call for a quote". */
export interface PriceItem {
  id: string;
  label: string;
  amount: number | null;
  note?: string; // e.g. "credited to the repair if you go ahead"
}

/** A finished job posted from the truck: proof of real work, not stock photos. */
export interface Job {
  id: string;
  photoUrl: string;
  beforeUrl?: string | null;
  caption: string;
  town?: string;
  date: string; // YYYY-MM-DD
  /** The owner confirmed they took the photo or have the right to use it. */
  photoRights: boolean;
}

export interface Brand {
  name: string;
  tagline: string; // second line under the name, e.g. "Mechanical"
  logoUrl: string | null;
  primary: string;
  accent: string;
  ink: string;
}

export interface SiteCopy {
  kicker: string;
  headlineA: string;
  headlineB: string;
  intro: string;
  servicesTitle: string;
  servicesIntro: string;
  areaTitle: string;
  areaIntro: string;
  requestTitle: string;
  requestIntro: string;
}

/** Claims customers rely on. Only shown when the owner has said they're true. */
export interface Facts {
  yearFounded: number | null;
  familyOwned: boolean;
  awards: string[];
  licensedInsured: boolean;
  emergency247: boolean;
}

/** Something the importer wasn't sure about. Shown highlighted until the owner confirms it. */
export interface ConfirmItem {
  label: string;
  detail: string;
  source?: string;
}
export type ConfirmKey = 'phone' | 'hours' | 'towns' | 'services' | 'licence' | 'emergency' | 'name' | 'extraServices';

export interface BusinessProfile {
  version: 1;
  brand: Brand;
  phone: string;
  email: string | null;
  city: string;
  province: string;
  towns: string[];
  services: Service[];
  hours: WeekHours;
  overrides: Override[];
  special: Special | null;
  availability: Availability;
  copy: SiteCopy;
  facts: Facts;
  prices: PriceItem[];
  jobs: Job[];
  reviewsUrl: string | null;
  /** Google Business Profile place id: powers the rating, reviews and the "leave a review" link. */
  googlePlaceId: string | null;
  bookingUrl: string | null;
  timezone: string; // IANA, e.g. America/Vancouver
  confirm: Partial<Record<ConfirmKey, ConfirmItem>>;
}

export const DEFAULT_BRAND: Brand = {
  name: 'Your Shop',
  tagline: 'Heating & Cooling',
  logoUrl: null,
  primary: '#2E7D4A',
  accent: '#F7A928',
  ink: '#10251A',
};

export function emptyHours(): WeekHours {
  return { Mon: null, Tue: null, Wed: null, Thu: null, Fri: null, Sat: null, Sun: null };
}

export function weekdayHours(open = 8, close = 17): WeekHours {
  return { Mon: [open, close], Tue: [open, close], Wed: [open, close], Thu: [open, close], Fri: [open, close], Sat: null, Sun: null };
}

export type ProfileInput = Omit<Partial<BusinessProfile>, 'brand' | 'copy' | 'facts'> & { brand?: Partial<Brand>; copy?: Partial<SiteCopy>; facts?: Partial<Facts> };

export function newProfile(partial: ProfileInput = {}): BusinessProfile {
  const brand = { ...DEFAULT_BRAND, ...(partial.brand ?? {}) };
  const city = partial.city ?? 'Your Town';
  return {
    version: 1,
    brand,
    phone: partial.phone ?? '',
    email: partial.email ?? null,
    city,
    province: partial.province ?? 'BC',
    towns: partial.towns ?? [city],
    services: partial.services ?? [],
    hours: partial.hours ?? weekdayHours(),
    overrides: partial.overrides ?? [],
    special: partial.special ?? null,
    availability: partial.availability ?? { kind: 'normal', until: null },
    copy: {
      kicker: 'Heating · Cooling · Plumbing',
      headlineA: 'Heating & cooling for',
      headlineB: `${city}.`,
      intro: `Furnaces, air conditioning and plumbing for homes and businesses in ${city} and nearby.`,
      servicesTitle: 'What we do',
      servicesIntro: 'Plain answers, fair quotes, and a crew that shows up when we say we will.',
      areaTitle: 'Where we work',
      areaIntro: `Based in ${city} and serving nearby communities.`,
      requestTitle: 'Get it fixed',
      requestIntro: 'Call for anything urgent. For everything else, send a request and we’ll get back to you.',
      ...(partial.copy ?? {}),
    },
    facts: { yearFounded: null, familyOwned: false, awards: [], licensedInsured: false, emergency247: false, ...(partial.facts ?? {}) },
    prices: partial.prices ?? [],
    jobs: partial.jobs ?? [],
    reviewsUrl: partial.reviewsUrl ?? null,
    googlePlaceId: partial.googlePlaceId ?? null,
    bookingUrl: partial.bookingUrl ?? null,
    timezone: partial.timezone ?? 'America/Vancouver',
    confirm: partial.confirm ?? {},
  };
}

// ---------- validation (hand-rolled so the core has no dependencies) ----------

const HEX = /^#[0-9a-fA-F]{6}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const LIMITS = {
  name: 40,
  tagline: 30,
  serviceName: 40,
  serviceBlurb: 140,
  specialTitle: 60,
  specialDetail: 80,
  town: 40,
  towns: 30,
  services: 16,
  copy: 280,
  prices: 12,
  priceLabel: 40,
  priceNote: 80,
  jobs: 24,
  jobCaption: 120,
} as const;

/** Returns a list of problems; empty means valid. Used before saving and publishing. */
export function validateProfile(p: BusinessProfile): string[] {
  const errs: string[] = [];
  if (p.version !== 1) errs.push('Unknown profile version.');
  if (!p.brand.name.trim()) errs.push('The business needs a name.');
  if (p.brand.name.length > LIMITS.name) errs.push('The business name is too long.');
  if (p.brand.tagline.length > LIMITS.tagline) errs.push('The second line of the name is too long.');
  for (const c of [p.brand.primary, p.brand.accent, p.brand.ink]) if (!HEX.test(c)) errs.push(`Colour ${c} isn't valid.`);
  if (p.phone && digits(p.phone).length < 10) errs.push('The phone number looks incomplete.');
  if (p.towns.length > LIMITS.towns) errs.push('Too many towns.');
  if (p.towns.some((t) => !t.trim() || t.length > LIMITS.town)) errs.push('A town name is empty or too long.');
  if (p.services.length > LIMITS.services) errs.push('Too many services.');
  for (const s of p.services) {
    if (!s.name.trim()) errs.push('A service has no name.');
    if (s.name.length > LIMITS.serviceName) errs.push(`Service “${s.name}” has too long a name.`);
    if (s.blurb.length > LIMITS.serviceBlurb) errs.push(`Service “${s.name}” has too long a description.`);
  }
  for (const d of DAYS) {
    const h = p.hours[d];
    if (h && !(h[0] >= 0 && h[1] <= 24 && h[0] < h[1])) errs.push(`${d} hours don't make sense.`);
  }
  for (const o of p.overrides) {
    if (!DATE.test(o.from) || !DATE.test(o.to) || o.from > o.to) errs.push('A holiday has invalid dates.');
    if (!o.closed && !(typeof o.open === 'number' && typeof o.close === 'number' && o.open < o.close)) errs.push('A holiday has invalid hours.');
  }
  if (p.special) {
    if (!p.special.title.trim()) errs.push('The deal needs a headline.');
    if (p.special.title.length > LIMITS.specialTitle) errs.push('The deal headline is too long.');
    if (!DATE.test(p.special.ends)) errs.push('The deal needs a last day.');
  }
  if (p.prices.length > LIMITS.prices) errs.push('Too many prices.');
  for (const x of p.prices) {
    if (!x.label.trim() || x.label.length > LIMITS.priceLabel) errs.push('A price needs a short name.');
    if (x.amount !== null && !(Number.isFinite(x.amount) && x.amount >= 0 && x.amount < 100000)) errs.push(`The price for “${x.label}” doesn't look right.`);
    if ((x.note ?? '').length > LIMITS.priceNote) errs.push(`The note on “${x.label}” is too long.`);
  }
  if (p.jobs.length > LIMITS.jobs) errs.push('Too many work photos; remove an old one.');
  for (const j of p.jobs) {
    if (!j.photoUrl) errs.push('A work photo is missing its picture.');
    if (!j.caption.trim() || j.caption.length > LIMITS.jobCaption) errs.push('Each work photo needs a short caption.');
    if (!DATE.test(j.date)) errs.push('A work photo has an invalid date.');
  }
  if (p.availability.kind !== 'normal' && !p.availability.until) errs.push('Availability needs a time to switch off.');
  for (const [k, v] of Object.entries(p.copy)) if (typeof v !== 'string' || v.length > LIMITS.copy) errs.push(`Text “${k}” is too long.`);
  return errs;
}

export function digits(s: string): string {
  return (s || '').replace(/\D/g, '');
}

export function formatPhone(s: string): string {
  const d = digits(s).replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : s.trim();
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'site';
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Every user-visible string, used by publish checks to find new wording. */
export function profileTexts(p: BusinessProfile): string[] {
  return [
    p.brand.name,
    p.brand.tagline,
    p.special?.title,
    p.special?.detail,
    ...Object.values(p.copy),
    ...p.services.flatMap((s) => [s.name, s.blurb]),
    ...p.prices.flatMap((x) => [x.label, x.note]),
    ...p.jobs.map((j) => j.caption),
  ].filter((t): t is string => typeof t === 'string' && t.length > 0);
}

// ---------- service areas ----------

/** Canadian forward sortation area, e.g. "V3B". Full postal codes are cut to the first 3 characters. */
const FSA = /^([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])(\s?\d[ABCEGHJ-NPRSTV-Z]\d)?$/i;

/**
 * Clean up a typed service area. Towns get title case; postal codes become the
 * 3-character area (we never store a customer-level full postal code).
 */
export function normalizeArea(input: string): string | null {
  const t = input.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  const m = t.match(FSA);
  if (m) return m[1].toUpperCase();
  if (t.length > LIMITS.town || /[<>{}]/.test(t)) return null;
  return t
    .toLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase())
    .replace(/\b(Of|The|And)\b/g, (w) => w.toLowerCase());
}

export function isPostalArea(area: string): boolean {
  return /^[A-Z]\d[A-Z]$/.test(area);
}

/** Add an area if new (case-insensitive). Returns the same list if nothing changed. */
export function addArea(list: string[], input: string): string[] {
  const a = normalizeArea(input);
  if (!a || list.some((x) => x.toLowerCase() === a.toLowerCase())) return list;
  return [...list, a];
}

export function formatPrice(x: PriceItem): string {
  if (x.amount === null) return 'Call for a quote';
  return Number.isInteger(x.amount) ? `$${x.amount}` : `$${x.amount.toFixed(2)}`;
}

export type ProfileKey = Exclude<keyof BusinessProfile, 'version'>;
export const EDITABLE_KEYS: ProfileKey[] = [
  'brand', 'phone', 'email', 'city', 'province', 'towns', 'services', 'hours', 'overrides', 'special',
  'availability', 'copy', 'facts', 'prices', 'jobs', 'reviewsUrl', 'googlePlaceId', 'bookingUrl', 'timezone', 'confirm',
];

/** Take only some fields from the draft onto the live profile (for one-tap updates). */
export function mergeFields(live: BusinessProfile | null, draft: BusinessProfile, keys: ProfileKey[]): BusinessProfile {
  if (!live) return draft;
  const out = { ...live } as Record<string, unknown>;
  for (const k of keys) out[k] = draft[k];
  return out as unknown as BusinessProfile;
}

/** Which top-level fields differ between two profiles. */
export function changedKeys(a: BusinessProfile | null, b: BusinessProfile): ProfileKey[] {
  if (!a) return EDITABLE_KEYS.slice();
  return EDITABLE_KEYS.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}
