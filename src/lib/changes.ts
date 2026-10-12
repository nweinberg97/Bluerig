// "Type a change": free text in, a ChangeProposal out. A proposal is never applied by
// itself. The editor opens the matching panel pre-filled and the owner presses Save.
// Both the rule parser and the language model produce this same shape, and anything
// the model returns is re-validated here before the owner sees it.

import type { BusinessProfile, Override } from './profile';
import { addArea, digits, formatPhone, LIMITS, normalizeArea, uid } from './profile';
import { addDays, localDate, untilFromPreset, type UntilPreset } from './time';

export type Panel = 'hours' | 'brand' | 'prices' | 'photos' | 'reviews' | 'areas' | 'phone' | 'special' | 'status';

export type ChangeProposal =
  | { kind: 'phone'; phone: string }
  | { kind: 'name'; name: string }
  | { kind: 'holiday'; from: string; to: string; closed: boolean; open?: number; close?: number; label?: string }
  | { kind: 'status'; status: 'normal' | 'booked' | 'emergency'; until?: UntilPreset }
  | { kind: 'special'; title: string; detail?: string; ends: string | null }
  | { kind: 'addArea'; area: string }
  | { kind: 'removeArea'; area: string }
  | { kind: 'addService'; name: string }
  | { kind: 'price'; label: string; amount: number | null }
  | { kind: 'open'; panel: Panel };

export interface ParseResult {
  proposal: ChangeProposal;
  /** One plain sentence telling the owner what we filled in. */
  message: string;
}

const PANELS: Panel[] = ['hours', 'brand', 'prices', 'photos', 'reviews', 'areas', 'phone', 'special', 'status'];
const PRESETS: UntilPreset[] = ['tonight', 'morning', '4h', '24h', 'week'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Checks an untrusted proposal (e.g. from the model). Returns a cleaned copy or null. */
export function sanitizeProposal(x: unknown): ChangeProposal | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
  switch (o.kind) {
    case 'phone': {
      const p = typeof o.phone === 'string' ? digits(o.phone) : '';
      return p.length === 10 || (p.length === 11 && p[0] === '1') ? { kind: 'phone', phone: formatPhone(p) } : null;
    }
    case 'name': {
      const n = str(o.name, LIMITS.name);
      return n ? { kind: 'name', name: n } : null;
    }
    case 'holiday': {
      if (typeof o.from !== 'string' || !DATE.test(o.from)) return null;
      const to = typeof o.to === 'string' && DATE.test(o.to) ? o.to : o.from;
      const [from, until] = o.from <= to ? [o.from, to] : [to, o.from];
      const closed = o.closed !== false;
      const open = typeof o.open === 'number' && o.open >= 0 && o.open < 24 ? o.open : undefined;
      const close = typeof o.close === 'number' && o.close > 0 && o.close <= 24 ? o.close : undefined;
      if (!closed && !(open !== undefined && close !== undefined && open < close)) return { kind: 'holiday', from, to: until, closed: false, open: 9, close: 13 };
      return { kind: 'holiday', from, to: until, closed, ...(closed ? {} : { open, close }), label: str(o.label, 40) ?? undefined };
    }
    case 'status': {
      if (o.status !== 'normal' && o.status !== 'booked' && o.status !== 'emergency') return null;
      const until = PRESETS.includes(o.until as UntilPreset) ? (o.until as UntilPreset) : undefined;
      return { kind: 'status', status: o.status, ...(o.status === 'normal' ? {} : { until: until ?? (o.status === 'emergency' ? 'tonight' : 'week') }) };
    }
    case 'special': {
      const title = str(o.title, LIMITS.specialTitle);
      if (!title) return null;
      const ends = typeof o.ends === 'string' && DATE.test(o.ends) ? o.ends : null;
      return { kind: 'special', title, detail: str(o.detail, LIMITS.specialDetail) ?? undefined, ends };
    }
    case 'addArea':
    case 'removeArea': {
      const a = typeof o.area === 'string' ? normalizeArea(o.area) : null;
      return a ? { kind: o.kind, area: a } : null;
    }
    case 'addService': {
      const n = str(o.name, LIMITS.serviceName);
      return n ? { kind: 'addService', name: n } : null;
    }
    case 'price': {
      const label = str(o.label, LIMITS.priceLabel);
      const amount = o.amount === null ? null : typeof o.amount === 'number' && o.amount >= 0 && o.amount < 100000 ? Math.round(o.amount * 100) / 100 : undefined;
      return label && amount !== undefined ? { kind: 'price', label, amount } : null;
    }
    case 'open':
      return PANELS.includes(o.panel as Panel) ? { kind: 'open', panel: o.panel as Panel } : null;
  }
  return null;
}

/** Find an existing price line that a typed label refers to ("diagnostic" → "Diagnostic fee"). */
export function matchPrice(p: BusinessProfile, label: string): string | null {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['fee', 'the', 'our', 'rate', 'charge', 'price'].includes(w));
  const want = words(label);
  let best: { id: string; score: number } | null = null;
  for (const x of p.prices) {
    const have = words(x.label);
    const score = want.filter((w) => have.some((h) => h.startsWith(w) || w.startsWith(h))).length;
    if (score > 0 && (!best || score > best.score)) best = { id: x.id, score };
  }
  return best?.id ?? null;
}

/**
 * Apply a confirmed proposal to a draft. The editor calls this only after the owner
 * presses Save in the pre-filled panel (and, for phone numbers, typed it twice).
 */
export function applyProposal(p: BusinessProfile, c: ChangeProposal, now: Date): BusinessProfile {
  switch (c.kind) {
    case 'phone':
      return { ...p, phone: c.phone };
    case 'name':
      return { ...p, brand: { ...p.brand, name: c.name } };
    case 'holiday': {
      const o: Override = { id: uid(), from: c.from, to: c.to, closed: c.closed, label: c.label ?? 'Holiday hours', ...(c.closed ? {} : { open: c.open, close: c.close }) };
      return { ...p, overrides: [...p.overrides.filter((x) => !(x.from === c.from && x.to === c.to)), o] };
    }
    case 'status':
      return {
        ...p,
        availability: c.status === 'normal' ? { kind: 'normal', until: null } : { kind: c.status, until: untilFromPreset(c.until ?? 'tonight', now, p.timezone) },
      };
    case 'special':
      return { ...p, special: { title: c.title, detail: c.detail, ends: c.ends ?? addDays(localDate(now, p.timezone), 30) } };
    case 'addArea':
      return { ...p, towns: addArea(p.towns, c.area) };
    case 'removeArea':
      return { ...p, towns: p.towns.filter((t) => t.toLowerCase() !== c.area.toLowerCase()) };
    case 'addService':
      if (p.services.some((s) => s.name.toLowerCase() === c.name.toLowerCase())) return p;
      return { ...p, services: [{ id: uid(), name: c.name, blurb: '', icon: 'wrench' }, ...p.services] };
    case 'price': {
      const id = matchPrice(p, c.label);
      if (id) return { ...p, prices: p.prices.map((x) => (x.id === id ? { ...x, amount: c.amount } : x)) };
      return { ...p, prices: [...p.prices, { id: uid(), label: c.label, amount: c.amount }] };
    }
    case 'open':
      return p;
  }
}
