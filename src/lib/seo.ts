// What Google reads: page title, description and schema.org data. Generated from the
// same profile, so adding a town on the phone updates "areas served" on the next publish.

import type { BusinessProfile } from './profile';
import { DAYS, isPostalArea } from './profile';
import { PROVINCES } from './places-ca';
import { isSpecialLive } from './time';

const SCHEMA_DAY: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
};
const hhmm = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;

export function businessType(p: BusinessProfile): string {
  const names = p.services.map((s) => s.name.toLowerCase()).join(' ') + ' ' + p.brand.tagline.toLowerCase();
  const plumbing = /plumb|drain|sewer|water heater|hot water|tankless/.test(names);
  const hvac = /heat|furnace|boiler|cool|air|hvac|ac\b|duct|fireplace/.test(names);
  return plumbing && !hvac ? 'Plumber' : 'HVACBusiness';
}

export function pageTitle(p: BusinessProfile): string {
  const what = businessType(p) === 'Plumber' ? 'Plumbing' : 'Heating, Cooling & Plumbing';
  return `${p.brand.name} · ${what} in ${p.city}, ${p.province}`;
}

export function metaDescription(p: BusinessProfile): string {
  const towns = p.towns.filter((t) => !isPostalArea(t));
  const list = towns.length > 4 ? `${towns.slice(0, 4).join(', ')} and nearby` : towns.join(', ');
  const svc = p.services.slice(0, 3).map((s) => s.name.toLowerCase()).join(', ');
  const call = p.phone ? ` Call ${p.phone}.` : '';
  return `${p.brand.name}: ${svc || 'heating, cooling and plumbing'} for homes and businesses in ${list || p.city}.${call}`.slice(0, 300);
}

// No aggregateRating: Google doesn't allow marking up ratings collected on another
// site (like Google reviews) as your own, so we leave it out on purpose.
export function jsonLd(p: BusinessProfile, url: string, now: Date): Record<string, unknown> {
  const areaServed = p.towns.map((t) =>
    isPostalArea(t)
      ? { '@type': 'PostalCodeRangeSpecification', addressCountry: 'CA', postalCodeBegin: t, postalCodeEnd: t }
      : { '@type': 'City', name: `${t}, ${PROVINCES[p.province] ?? p.province}` },
  );
  const hours = DAYS.flatMap((d) => {
    const h = p.hours[d];
    return h ? [{ '@type': 'OpeningHoursSpecification', dayOfWeek: SCHEMA_DAY[d], opens: hhmm(h[0]), closes: hhmm(h[1]) }] : [];
  });
  const special = p.overrides.map((o) => ({
    '@type': 'OpeningHoursSpecification',
    validFrom: o.from,
    validThrough: o.to,
    ...(o.closed ? { opens: '00:00', closes: '00:00' } : { opens: hhmm(o.open ?? 9), closes: hhmm(o.close ?? 17) }),
  }));
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': businessType(p),
    name: p.brand.name,
    url,
    telephone: p.phone || undefined,
    email: p.email || undefined,
    image: p.brand.logoUrl || undefined,
    address: { '@type': 'PostalAddress', addressLocality: p.city, addressRegion: p.province, addressCountry: 'CA' },
    areaServed,
    openingHoursSpecification: hours,
    specialOpeningHoursSpecification: special.length ? special : undefined,
    hasOfferCatalog: p.services.length
      ? { '@type': 'OfferCatalog', name: 'Services', itemListElement: p.services.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.blurb || undefined } })) }
      : undefined,
    makesOffer: p.prices
      .filter((x) => x.amount !== null)
      .map((x) => ({ '@type': 'Offer', name: x.label, price: x.amount, priceCurrency: 'CAD' })),
    foundingDate: p.facts.yearFounded ? String(p.facts.yearFounded) : undefined,
  };
  if (isSpecialLive(p, now) && p.special) ld.description = `${p.special.title}${p.special.detail ? ` · ${p.special.detail}` : ''}`;
  return JSON.parse(JSON.stringify(ld)); // drop undefined
}
