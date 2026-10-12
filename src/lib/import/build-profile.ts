// Turn what we found on a shop's old website into a draft Bluerig profile. Facts we
// weren't sure of become "confirm" items that show highlighted in the preview, and
// claims (24/7, licensed, year founded) stay OFF until the owner says they're true.

import type { BusinessProfile, ConfirmItem, ConfirmKey, Service } from '../profile';
import { newProfile, uid, weekdayHours } from '../profile';
import { PROVINCE_TZ } from '../places-ca';
import type { Extracted } from './extract';

export interface ImportSummary {
  profile: BusinessProfile;
  /** Every fact with where it came from, for the admin review screen. */
  sources: { field: string; value: string; source: string; sure: boolean }[];
  warnings: string[];
}

const kickerFor = (services: Service[]) => {
  const n = services.map((s) => s.name.toLowerCase()).join(' ');
  const parts = [
    /furnace|boiler|heat|fireplace|radiant/.test(n) && 'Heating',
    /air conditioning|mini-split|heat pump/.test(n) && 'Cooling',
    /plumb|drain|sewer|water|backflow|sump/.test(n) && 'Plumbing',
  ].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : 'Heating · Cooling · Plumbing';
};

export function buildProfile(x: Extracted, siteUrl: string): ImportSummary {
  const sources: ImportSummary['sources'] = [];
  const warnings: string[] = [];
  const confirm: Partial<Record<ConfirmKey, ConfirmItem>> = {};
  const note = (field: string, value: string, f: { source: string; sure: boolean }) => sources.push({ field, value, source: f.source, sure: f.sure });

  const city = x.city?.value ?? 'Your Town';
  const province = x.province?.value ?? 'BC';
  if (x.city) note('City', city, x.city);
  else warnings.push('No town found. Set the city before sending the preview.');
  if (x.province) note('Province', province, x.province);

  const services: Service[] = x.services.map((s) => ({ id: uid(), name: s.value.name, blurb: s.value.blurb, icon: s.value.icon }));
  x.services.forEach((s) => note('Service', s.value.name + (s.value.blurb ? ` — “${s.value.blurb}”` : ''), s));
  if (!services.length) warnings.push('No services found. Add a few before sending.');

  const p = newProfile({
    brand: {
      name: x.name?.value ?? 'Your Shop',
      tagline: x.tagline?.value ?? '',
      logoUrl: x.logoUrl?.value ?? null,
      ...(x.colours?.value ?? {}),
    },
    phone: x.phone?.value ?? '',
    email: x.email?.value ?? null,
    city,
    province,
    towns: [...new Set([city, ...(x.towns?.value ?? [])])].slice(0, 12),
    services,
    hours: x.hours?.value ?? weekdayHours(),
    prices: x.prices.map((f) => f.value),
    reviewsUrl: x.reviewsUrl?.value ?? null,
    bookingUrl: x.bookingUrl?.value ?? null,
    timezone: PROVINCE_TZ[province] ?? 'America/Vancouver',
  });
  p.copy.kicker = kickerFor(services);

  if (x.name) note('Name', x.name.value + (x.tagline ? ` / ${x.tagline.value}` : ''), x.name);
  if (!x.name?.sure) confirm.name = { label: 'Business name', detail: 'We read this from the page title. Check the spelling.', source: x.name?.source };
  if (x.phone) note('Phone', x.phone.value, x.phone);
  if (!x.phone || !x.phone.sure) confirm.phone = { label: 'Phone number', detail: x.phone ? 'Found once on the site. Make sure it’s the one customers should call.' : 'No phone number found.', source: x.phone?.source };
  if (x.email) note('Email', x.email.value, x.email);
  if (x.hours) note('Hours', 'from site', x.hours);
  confirm.hours = x.hours
    ? { label: 'Hours', detail: 'Copied from the old site. Old sites often have old hours.', source: x.hours.source }
    : { label: 'Hours', detail: 'Not listed on the old site. We put in Mon–Fri 8–5 as a starting point.' };
  confirm.towns = { label: 'Towns you serve', detail: x.towns ? 'Towns named on the old site. Remove any you don’t want to work in.' : 'Only your home town so far. Add the others you serve.', source: x.towns?.source };
  if (services.length) confirm.services = { label: 'Services', detail: 'We matched these to what your old site talks about. Remove any you don’t do.', source: 'your website' };
  for (const pr of x.prices) note('Price', `${pr.value.label} $${pr.value.amount}`, pr);
  if (x.prices.length) warnings.push('Prices were copied from the old site and may be out of date. They stay unpublished until the owner checks them.');

  // Claims: found ≠ true today. Leave them off; ask the owner.
  if (x.emergency247) {
    note('Says 24/7 or emergency', 'yes', x.emergency247);
    confirm.emergency = { label: '24/7 emergency service', detail: 'Your old site mentions emergency or 24/7 service. Turn it on only if it’s still true.', source: x.emergency247.source };
  }
  if (x.licensedInsured) {
    note('Says licensed & insured', 'yes', x.licensedInsured);
    confirm.licence = { label: 'Licensed and insured', detail: 'Your old site says this. Turn it on once you’ve confirmed it’s current.', source: x.licensedInsured.source };
  }
  if (x.yearFounded) {
    note('Year founded', String(x.yearFounded.value), x.yearFounded);
    p.facts.yearFounded = null; // shown only after the owner confirms
    warnings.push(`Old site says founded ${x.yearFounded.value}. Ask the owner before showing it.`);
  }
  if (x.familyOwned) note('Says family-owned', 'yes', x.familyOwned);
  if (x.logoUrl) note('Logo', x.logoUrl.value, x.logoUrl);
  else warnings.push('No logo found. The preview will use the name in their colours.');
  if (x.colours) note('Colours', `${x.colours.value.primary} / ${x.colours.value.accent}`, x.colours);
  if (x.reviewsUrl) note('Google reviews link', x.reviewsUrl.value, x.reviewsUrl);
  if (x.bookingUrl) note('Booking link', x.bookingUrl.value, x.bookingUrl);

  p.confirm = confirm;
  sources.unshift({ field: 'Website', value: siteUrl, source: 'you pasted it', sure: true });
  return { profile: p, sources, warnings };
}
