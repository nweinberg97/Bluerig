import 'server-only';
import type { ParseResult } from '../changes';
import { sanitizeProposal } from '../changes';
import type { BusinessProfile } from '../profile';
import { parseRules } from '../parse-rules';
import { localDate } from '../time';
import { llmJson } from './llm';

const nul = (t: string | string[]) => ({ type: Array.isArray(t) ? [...t, 'null'] : [t, 'null'] });
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'phone', 'name', 'from', 'to', 'closed', 'status', 'until', 'title', 'detail', 'ends', 'area', 'label', 'amount', 'panel', 'message'],
  properties: {
    kind: { type: 'string', enum: ['phone', 'name', 'holiday', 'status', 'special', 'addArea', 'removeArea', 'addService', 'price', 'open', 'none'] },
    phone: nul('string'),
    name: nul('string'),
    from: nul('string'),
    to: nul('string'),
    closed: nul('boolean'),
    status: { type: ['string', 'null'], enum: ['normal', 'booked', 'emergency', null] },
    until: { type: ['string', 'null'], enum: ['tonight', 'morning', '4h', '24h', 'week', null] },
    title: nul('string'),
    detail: nul('string'),
    ends: nul('string'),
    area: nul('string'),
    label: nul('string'),
    amount: nul('number'),
    panel: { type: ['string', 'null'], enum: ['hours', 'brand', 'prices', 'photos', 'reviews', 'areas', 'phone', 'special', 'status', null] },
    message: { type: 'string' },
  },
};

const SYSTEM = `You turn a short note from the owner of a heating, cooling or plumbing shop in Canada into ONE change to their website.
Kinds: phone (new phone number), name (business name), holiday (closed or special hours on dates, from/to as YYYY-MM-DD), status (emergency = taking emergency calls now; booked = booked up; normal = clear it; until = when it switches off), special (a deal with a last day "ends" YYYY-MM-DD), addArea/removeArea (a town or Canadian postal code they serve), addService, price (a line on their price list, amount in dollars), open (just open a panel), none (not a website change).
Never invent facts, prices, dates or claims that the note doesn't state. Put unused fields as null. "message" is one short plain sentence for the owner, no jargon.`;

/** Rules first (instant, free); the model only when rules give up. */
export async function parseChange(text: string, p: BusinessProfile, now: Date): Promise<ParseResult | null> {
  const rules = parseRules(text, p, now);
  if (rules) return rules;
  const out = await llmJson<Record<string, unknown>>({
    name: 'change',
    schema: SCHEMA,
    system: SYSTEM,
    user: `Today is ${localDate(now, p.timezone)} (${p.timezone}). Business: ${p.brand.name} in ${p.city}, ${p.province}. Towns served: ${p.towns.join(', ')}. Price list: ${p.prices.map((x) => `${x.label} ${x.amount ?? 'quote'}`).join('; ') || 'none'}.\nOwner's note: """${text.slice(0, 500)}"""`,
  });
  if (!out || out.kind === 'none') return null;
  const cleaned = Object.fromEntries(Object.entries(out).filter(([, v]) => v !== null));
  const proposal = sanitizeProposal(cleaned);
  if (!proposal) return null;
  const message = typeof out.message === 'string' && out.message.length < 200 ? out.message : 'Filled in. Check it, then save.';
  return { proposal, message };
}
