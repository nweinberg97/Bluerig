// The rule-based parser for "type a change". Fast, free, private, and good enough for
// the common things owners type. The language model is only asked when this gives up.

import type { ChangeProposal, ParseResult } from './changes';
import type { BusinessProfile } from './profile';
import { formatPrice, normalizeArea } from './profile';
import { findTowns } from './places-ca';
import { nextDate } from './time';

const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const POSTAL = /\b([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])(?:\s?\d[ABCEGHJ-NPRSTV-Z]\d)?\b/i;

function r(proposal: ChangeProposal, message: string): ParseResult {
  return { proposal, message };
}

export function parseRules(raw: string, p: BusinessProfile, now: Date): ParseResult | null {
  const t = raw.trim().replace(/\s+/g, ' ');
  const low = t.toLowerCase();
  if (!t) return null;
  const tz = p.timezone;

  // Phone number
  const ph = t.match(/(\+?1[\s.-]?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
  if (ph && /phone|number|call|cell|line/.test(low)) {
    return r({ kind: 'phone', phone: ph[2] }, 'New phone number filled in. Type it once more to make sure it’s right.');
  }

  // Business name
  const nm = t.match(/(?:change|rename|update)\s+(?:the\s+|our\s+|my\s+)?(?:business\s+|company\s+|shop\s+)?name\s+to\s+(.+)$/i);
  if (nm) return r({ kind: 'name', name: cap1(nm[1].replace(/[.!]+$/, '').trim()).slice(0, 40) }, 'New name filled in. Check it, then save.');
  if (/\blogo\b|\bcolou?rs?\b/.test(low)) return r({ kind: 'open', panel: 'brand' }, 'Here’s your logo, name and colours.');

  // Holidays: "closed dec 24-26", "closed Dec 25 to Jan 1", "off on nov 11"
  const cl = low.match(new RegExp(`(?:closed|off|shut)\\s+(?:on\\s+|from\\s+)?${MONTH}\\.?\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:-|–|to|through|thru|until)\\s*(?:${MONTH}\\.?\\s*)?(\\d{1,2}))?`));
  if (cl) {
    const from = nextDate(cl[1], cl[2], now, tz);
    if (from) {
      let to = cl[4] ? nextDate(cl[3] ?? cl[1], cl[4], now, tz) : from;
      if (!to || to < from) to = from;
      return r({ kind: 'holiday', from, to, closed: true, label: 'Holiday hours' }, 'Holiday dates filled in. Your regular hours stay the same.');
    }
  }

  // Availability
  if (/back to normal|clear (the )?(status|banner)|turn off emergency|emergency (mode )?off|available again|not booked/.test(low)) {
    return r({ kind: 'status', status: 'normal' }, 'Back to normal. The banner comes off your site.');
  }
  if (/booked|busy|full this week|no availability|slammed|not taking/.test(low)) {
    return r({ kind: 'status', status: 'booked', until: 'week' }, 'Set to “Booked up this week”. Choose when it switches off.');
  }
  if (/emergenc|on call|24\/?7 (now|tonight)|available (now|tonight|today)|crew (is )?(on|available)|dispatch/.test(low)) {
    const until = /tomorrow|morning/.test(low) ? 'morning' : /24 ?h|all day/.test(low) ? '24h' : 'tonight';
    return r({ kind: 'status', status: 'emergency', until }, 'Emergency mode ready: a red “call now” bar on your site. It switches itself off.');
  }

  // Prices: "diagnostic fee is now $119", "service call $95"
  const money = t.match(/\$\s?(\d{1,5}(?:\.\d{2})?)/);
  if (money && !/\boff\b|%|special|deal|promo|\bsave|discount|rebate|\b(until|till|thru)\b/.test(low)) {
    const label = t
      .replace(/\$\s?\d{1,5}(?:\.\d{2})?/, '')
      .replace(/\b(change|update|set|make|raise|lower|bump|our|my|the|is|are|now|to|from|at|it|price of|price for|price)\b/gi, ' ')
      .replace(/[.!:,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (label) {
      const amount = Number(money[1]);
      const existing = p.prices.find((x) => label.toLowerCase().split(' ').some((w) => w.length > 3 && x.label.toLowerCase().includes(w)));
      const msg = existing
        ? `${existing.label}: ${formatPrice(existing)} → $${amount}. Check it, then save.`
        : `New price line filled in: ${cap1(label)} $${amount}.`;
      return r({ kind: 'price', label: existing?.label ?? cap1(label).slice(0, 40), amount }, msg);
    }
  }

  // Deals
  if (/\$\s?\d|% ?off|special|deal|promo|tune-?up|rebate|discount/.test(low)) {
    const u = t.match(new RegExp(`\\b(?:until|till|til|ends?|through|thru)\\s+${MONTH}\\.?\\s*(\\d{1,2})`, 'i'));
    const ends = u ? nextDate(u[1], u[2], now, tz) : null;
    const title = t
      .replace(new RegExp(`\\b(?:until|till|til|ends?|through|thru)\\s+${MONTH}\\.?\\s*\\d{1,2}.*$`, 'i'), '')
      .replace(/^(add|post|run|new|put up)\s+(a\s+)?(special|deal|promo)[:\s-]*/i, '')
      .trim();
    return r(
      { kind: 'special', title: cap1(title).slice(0, 60), ends },
      ends ? 'Deal filled in with its last day. It takes itself down after that.' : 'Deal filled in. Pick a last day so it takes itself down.',
    );
  }

  // Service areas: towns or postal codes
  const removing = /\b(remove|drop|stop|no longer|don'?t|not)\b/.test(low);
  const postal = t.match(POSTAL);
  const towns = findTowns(t, p.province);
  const areaWords = /\b(serve|serving|service area|area|cover|covering|work in|working in|jobs in|town|city|add)\b/.test(low);
  if (postal || towns.length || (areaWords && /\b(area|serve|serving|cover|work in|jobs in)\b/.test(low))) {
    let area = postal ? normalizeArea(postal[0]) : towns[0] ?? null;
    if (!area) {
      // "we now serve Belcarra" with an unknown town: take the words after the verb
      const m = t.match(/\b(?:serve|serving|cover|covering|work in|jobs in|add)\s+(.+)$/i);
      area = m ? normalizeArea(m[1].replace(/[.!]+$/, '').replace(/\b(too|also|now)$/i, '')) : null;
    }
    if (area) {
      if (removing) return r({ kind: 'removeArea', area }, `${area} will be removed from the towns you serve.`);
      if (p.towns.some((x) => x.toLowerCase() === area!.toLowerCase())) return r({ kind: 'open', panel: 'areas' }, `${area} is already on your list.`);
      return r({ kind: 'addArea', area }, `${area} will be added to the towns you serve, and Google will see it too.`);
    }
  }

  // New service
  const sv = t.match(/^(?:we\s+)?(?:now\s+)?(?:add|offering|offer|do|we do|we now do|we also do|new service:?)\s+(.+)$/i);
  if (sv) {
    const n = sv[1].replace(/\binstalls?\b/i, 'installation').replace(/[.!]+$/, '').replace(/\s+(now|too|also)$/i, '');
    return r({ kind: 'addService', name: cap1(n).slice(0, 40) }, 'New service started. Add a line about it and a photo if you like.');
  }

  if (/\bphotos?\b|pictures?|before and after|before\/after|job pics?/.test(low)) return r({ kind: 'open', panel: 'photos' }, 'Add a photo of a job you just finished.');
  if (/reviews?|rating|stars?/.test(low)) return r({ kind: 'open', panel: 'reviews' }, 'Here’s where you ask for reviews.');
  if (/prices?|fees?|rates?|charge/.test(low)) return r({ kind: 'open', panel: 'prices' }, 'Here are your prices.');
  if (/hours|open|close/.test(low)) return r({ kind: 'open', panel: 'hours' }, 'Here are your hours.');
  return null;
}
