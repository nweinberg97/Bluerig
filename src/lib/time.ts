// Time rules: deals, availability and holidays switch themselves on and off.
// Everything is evaluated in the business's own timezone so "until Nov 30" means
// Nov 30 where the shop is, not where the server is.

import type { BusinessProfile, Day, DayHours, Override } from './profile';
import { DAYS } from './profile';

/** Local calendar date (YYYY-MM-DD) for an instant in a timezone. */
export function localDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function dayOf(date: string): Day {
  // date is a local calendar date; compute weekday without timezone drift
  const [y, m, d] = date.split('-').map(Number);
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return DAYS[(js + 6) % 7];
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export function isSpecialLive(p: BusinessProfile, now: Date): boolean {
  return !!p.special && localDate(now, p.timezone) <= p.special.ends;
}

export function isAvailabilityLive(p: BusinessProfile, now: Date): boolean {
  const a = p.availability;
  return a.kind !== 'normal' && !!a.until && now.getTime() < Date.parse(a.until);
}

export function overrideFor(p: BusinessProfile, date: string): Override | undefined {
  return p.overrides.find((o) => o.from <= date && date <= o.to);
}

/** Hours that actually apply on a date: a holiday wins over the normal week. */
export function hoursOn(p: BusinessProfile, date: string): DayHours {
  const o = overrideFor(p, date);
  if (o) return o.closed ? null : [o.open ?? 9, o.close ?? 17];
  return p.hours[dayOf(date)];
}

export function upcomingOverrides(p: BusinessProfile, now: Date): Override[] {
  const today = localDate(now, p.timezone);
  return p.overrides.filter((o) => o.to >= today).sort((a, b) => (a.from < b.from ? -1 : 1));
}

/** Drop holidays and deals that are over, and reset expired availability. Pure. */
export function pruneExpired(p: BusinessProfile, now: Date): BusinessProfile {
  const today = localDate(now, p.timezone);
  return {
    ...p,
    overrides: p.overrides.filter((o) => o.to >= today),
    special: p.special && p.special.ends >= today ? p.special : null,
    availability: isAvailabilityLive(p, now) ? p.availability : { kind: 'normal', until: null },
  };
}

export function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const m = Math.round((h - hh) * 60);
  const ap = hh >= 12 && hh < 24 ? 'pm' : 'am';
  const d = ((hh + 11) % 12) + 1;
  return `${d}${m ? ':' + String(m).padStart(2, '0') : ''}${ap}`;
}

export function fmtDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function fmtRange(from: string, to: string): string {
  if (from === to) return fmtDate(from);
  return from.slice(0, 7) === to.slice(0, 7) ? `${fmtDate(from)}–${Number(to.slice(8))}` : `${fmtDate(from)}–${fmtDate(to)}`;
}

/** "Open today 8am–5pm" / "Closed today · opens Monday at 8am" */
export function todayLine(p: BusinessProfile, now: Date): { open: boolean; text: string } {
  const today = localDate(now, p.timezone);
  const h = hoursOn(p, today);
  if (h) return { open: true, text: `Open today ${fmtHour(h[0])}–${fmtHour(h[1])}` };
  for (let i = 1; i <= 14; i++) {
    const d = addDays(today, i);
    const n = hoursOn(p, d);
    if (n) {
      const label = i === 1 ? 'tomorrow' : FULL[dayOf(d)];
      return { open: false, text: `Closed today · opens ${label} at ${fmtHour(n[0])}` };
    }
  }
  return { open: false, text: 'Closed today' };
}

export const FULL: Record<Day, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};

/** End of the local day, as an ISO instant, for "until end of today" availability. */
export function endOfLocalDay(now: Date, timeZone: string): string {
  // Walk forward minute by minute is overkill; find the next local midnight by checking hours.
  const today = localDate(now, timeZone);
  let t = now.getTime();
  for (let i = 0; i < 48 * 4; i++) {
    t += 15 * 60 * 1000;
    if (localDate(new Date(t), timeZone) !== today) return new Date(t - 60 * 1000).toISOString();
  }
  return new Date(now.getTime() + 12 * 3600 * 1000).toISOString();
}

/** Local hour (0-23) for an instant in a timezone. */
export function localHour(now: Date, timeZone: string): number {
  const h = new Intl.DateTimeFormat('en-CA', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now);
  return Number(h.replace(/\D/g, '')) % 24;
}

/**
 * When an emergency / booked status should switch itself off. Every status has an
 * end so nobody's site says "emergency crew available" at 3am by accident.
 */
export type UntilPreset = 'tonight' | 'morning' | '4h' | '24h' | 'week';
export function untilFromPreset(preset: UntilPreset, now: Date, timeZone: string): string {
  const H = 3600 * 1000;
  switch (preset) {
    case '4h':
      return new Date(now.getTime() + 4 * H).toISOString();
    case '24h':
      return new Date(now.getTime() + 24 * H).toISOString();
    case 'tonight':
      return endOfLocalDay(now, timeZone);
    case 'morning': {
      // 7am local tomorrow
      const tomorrow = addDays(localDate(now, timeZone), 1);
      let t = now.getTime();
      for (let i = 0; i < 48 * 4; i++) {
        t += 15 * 60 * 1000;
        const d = new Date(t);
        if (localDate(d, timeZone) === tomorrow && localHour(d, timeZone) >= 7) return d.toISOString();
      }
      return new Date(now.getTime() + 12 * H).toISOString();
    }
    case 'week': {
      // end of the coming Sunday, local
      const today = localDate(now, timeZone);
      const toSun = (7 - (DAYS.indexOf(dayOf(today)) + 1)) % 7;
      const t = now.getTime() + toSun * 24 * H;
      return endOfLocalDay(new Date(t), timeZone);
    }
  }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "Dec 24" / "december 24" → the next such date on or after today (local). */
export function nextDate(month: string, day: number | string, now: Date, timeZone: string): string | null {
  const m = MONTHS.indexOf(month.toLowerCase().slice(0, 3));
  const d = Number(day);
  if (m < 0 || !(d >= 1 && d <= 31)) return null;
  const today = localDate(now, timeZone);
  let y = Number(today.slice(0, 4));
  const make = (yy: number) => `${yy}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // reject impossible dates like Feb 30
  const check = new Date(Date.UTC(y, m, d));
  if (check.getUTCMonth() !== m) return null;
  if (make(y) < today) y += 1;
  return make(y);
}
