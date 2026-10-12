// Publish checks: the few things worth a second look before a change goes live.
// Blocking problems stop the publish; confirmations ask the owner to tick a box.

import type { BusinessProfile } from './profile';
import { formatPrice, profileTexts, validateProfile } from './profile';

export interface Confirmation {
  id: string;
  kind: 'price' | 'claim' | 'photo' | 'phone';
  text: string;
}

export interface CheckResult {
  blocking: string[];
  confirm: Confirmation[];
}

const PRICE = /\$\s?\d[\d,]*(?:\.\d{2})?/g;
const CLAIMS: [RegExp, string][] = [
  [/\blicen[cs]ed\b/i, 'licensed'],
  [/\binsured\b|\bwcb\b|\bworksafe/i, 'insured / WorkSafeBC'],
  [/\b24\s?\/\s?7\b|\b24 hours?\b|\baround the clock\b/i, 'available 24/7'],
  [/\bcertified\b|\bred seal\b|\btssa\b|\bgas ?fitter\b|\bmaster plumber\b/i, 'certified'],
  [/\bwarrant(y|ies|ied)\b/i, 'warranty'],
  [/\bguarantee[ds]?\b/i, 'guarantee'],
  [/\bbest\b|\b#1\b|\bnumber one\b|\bcheapest\b|\blowest price\b/i, 'best / cheapest'],
  [/\baward/i, 'award'],
];

const pricesIn = (texts: string[]) => new Set(texts.flatMap((t) => t.match(PRICE) ?? []).map((x) => x.replace(/\s/g, '')));

/** Compare the draft to what's live and list what to double-check. */
export function publishChecks(draft: BusinessProfile, live: BusinessProfile | null): CheckResult {
  const blocking = validateProfile(draft);
  const confirm: Confirmation[] = [];
  const liveTexts = live ? profileTexts(live) : [];
  const draftTexts = profileTexts(draft);

  // Prices in wording
  const oldP = pricesIn(liveTexts);
  for (const pr of pricesIn(draftTexts)) {
    if (!oldP.has(pr)) confirm.push({ id: `price:${pr}`, kind: 'price', text: `Is ${pr} the right price?` });
  }
  // Price list changes
  for (const x of draft.prices) {
    const before = live?.prices.find((y) => y.id === x.id);
    if (!before || before.amount !== x.amount) {
      confirm.push({ id: `pricelist:${x.id}:${x.amount}`, kind: 'price', text: `${x.label}: ${formatPrice(x)}${before ? ` (was ${formatPrice(before)})` : ''}. Is that right?` });
    }
  }

  // New claims customers rely on
  const liveJoined = liveTexts.join('\n');
  for (const [re, name] of CLAIMS) {
    const hit = draftTexts.find((t) => re.test(t));
    if (hit && !re.test(liveJoined)) {
      confirm.push({ id: `claim:${name}`, kind: 'claim', text: `Your site now says “${name}”. Only keep it if it’s true and you can back it up.` });
    }
  }

  // Photos without a rights confirmation
  for (const s of draft.services) {
    if (s.photoUrl && !s.photoRights) confirm.push({ id: `photo:svc:${s.id}`, kind: 'photo', text: `You took the photo for “${s.name}” or have permission to use it.` });
  }
  for (const j of draft.jobs) {
    if (!j.photoRights) confirm.push({ id: `photo:job:${j.id}`, kind: 'photo', text: `You took the photo “${j.caption}” or have permission to use it, and it shows no customer’s face, address or licence plate.` });
  }

  if (live && live.phone !== draft.phone) {
    confirm.push({ id: `phone:${draft.phone}`, kind: 'phone', text: `Customers will call ${draft.phone || '(no number)'}. Is that right?` });
  }
  return { blocking, confirm };
}

/** After the owner ticks the photo boxes, remember it so we don't ask again. */
export function markPhotoRights(p: BusinessProfile, ids: string[]): BusinessProfile {
  const set = new Set(ids);
  return {
    ...p,
    services: p.services.map((s) => (set.has(`photo:svc:${s.id}`) ? { ...s, photoRights: true } : s)),
    jobs: p.jobs.map((j) => (set.has(`photo:job:${j.id}`) ? { ...j, photoRights: true } : j)),
  };
}
