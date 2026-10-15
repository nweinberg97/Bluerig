// A made-up shop used by the landing page, the /example link and the demo. Not a real business.
import { newProfile, type BusinessProfile } from './profile';
import { addDays, localDate } from './time';

export function exampleProfile(now = new Date()): BusinessProfile {
  const tz = 'America/Vancouver';
  const today = localDate(now, tz);
  return newProfile({
    brand: { name: 'Northline', tagline: 'Mechanical', logoUrl: null, primary: '#1F6F8B', accent: '#F2A03D', ink: '#0D1B24' },
    phone: '604-555-0142',
    email: 'office@northline.example',
    city: 'Port Coquitlam',
    province: 'BC',
    towns: ['Port Coquitlam', 'Coquitlam', 'Port Moody', 'Pitt Meadows', 'Maple Ridge'],
    services: [
      { id: 's1', name: 'Furnaces', blurb: 'Repairs, replacements and yearly tune-ups.', icon: 'flame' },
      { id: 's2', name: 'Heat pumps', blurb: 'Heating and cooling in one system, sized for your home.', icon: 'pump' },
      { id: 's3', name: 'Air conditioning', blurb: 'Installs and repairs before the summer rush.', icon: 'snow' },
      { id: 's4', name: 'Hot water tanks', blurb: 'Tank and tankless, usually replaced the same week.', icon: 'drop' },
      { id: 's5', name: 'Drain cleaning', blurb: 'Slow drains and blockages, cleared and camera-checked.', icon: 'pipe' },
      { id: 's6', name: 'Maintenance plans', blurb: 'One visit a year keeps systems efficient and catches problems early.', icon: 'wrench' },
    ],
    prices: [
      { id: 'p1', label: 'Diagnostic fee', amount: 89, note: 'Credited to the repair if you go ahead' },
      { id: 'p2', label: 'Furnace tune-up', amount: 149 },
    ],
    special: { title: '$50 off furnace tune-ups', detail: 'Book before the cold hits', ends: addDays(today, 30) },
    facts: { yearFounded: 2004, familyOwned: true, awards: [], licensedInsured: true, emergency247: false },
    timezone: tz,
  });
}

/** The same shop as it would look straight after the website importer. */
export function importedExample(now = new Date()): BusinessProfile {
  const p = exampleProfile(now);
  p.special = null;
  p.prices = [{ id: 'p1', label: 'Diagnostic fee', amount: 89 }];
  p.facts = { yearFounded: null, familyOwned: false, awards: [], licensedInsured: false, emergency247: false };
  p.confirm = {
    hours: { label: 'Hours', detail: 'Copied from the old site. Old sites often have old hours.', source: 'northline.example/contact' },
    towns: { label: 'Towns you serve', detail: 'Towns named on the old site. Remove any you don’t want to work in.' },
    licence: { label: 'Licensed and insured', detail: 'Your old site says this. Turn it on once you’ve confirmed it’s current.' },
    emergency: { label: '24/7 emergency service', detail: 'Your old site mentions 24/7 service. Turn it on only if it’s still true.' },
  };
  return p;
}

/**
 * Example designs for the landing page's showcase. All made-up shops, labelled as
 * examples on the page. Replace with real client sites (with their permission)
 * once there are some.
 */
export function showcaseExamples(now = new Date()): { profile: BusinessProfile; kind: string }[] {
  const tz = 'America/Vancouver';
  const plumbing = newProfile({
    brand: { name: 'Kettle Creek', tagline: 'Plumbing', logoUrl: null, primary: '#0E6BA8', accent: '#F4C430', ink: '#0B1E33' },
    phone: '250-555-0161',
    city: 'Kelowna',
    province: 'BC',
    towns: ['Kelowna', 'West Kelowna', 'Lake Country', 'Peachland'],
    services: [
      { id: 'k1', name: 'Drain cleaning', blurb: 'Slow drains and blockages cleared, with a camera check if needed.', icon: 'pipe' },
      { id: 'k2', name: 'Hot water tanks', blurb: 'Tank and tankless installs and repairs.', icon: 'drop' },
      { id: 'k3', name: 'Leaks and repairs', blurb: 'Taps, toilets, pipes and fixtures.', icon: 'wrench' },
      { id: 'k4', name: 'Sump pumps', blurb: 'Installs and replacements before the spring melt.', icon: 'pump' },
    ],
    prices: [{ id: 'kp', label: 'Service call', amount: 95 }],
    copy: { kicker: 'Plumbing · Drains · Hot water', headlineA: 'Plumbing for', headlineB: 'Kelowna.', intro: 'Leaks, drains and hot water for homes and small businesses in Kelowna and nearby.' },
    timezone: tz,
  });
  const heating = newProfile({
    brand: { name: 'Prairie Comfort', tagline: 'Heating & Cooling', logoUrl: null, primary: '#B5422C', accent: '#F2B134', ink: '#2A1410' },
    phone: '306-555-0148',
    city: 'Saskatoon',
    province: 'SK',
    towns: ['Saskatoon', 'Martensville', 'Warman'],
    services: [
      { id: 'p1', name: 'Furnaces', blurb: 'Repairs and replacements, built for prairie winters.', icon: 'flame' },
      { id: 'p2', name: 'Air conditioning', blurb: 'Installs and servicing before the summer heat.', icon: 'snow' },
      { id: 'p3', name: 'Boilers', blurb: 'Hot water heating systems, serviced and repaired.', icon: 'flame' },
    ],
    availability: { kind: 'emergency', until: new Date(now.getTime() + 6 * 3600e3).toISOString() },
    copy: { kicker: 'Heating · Cooling', headlineA: 'Warm homes in', headlineB: 'Saskatoon.', intro: 'Furnaces, boilers and air conditioning for homes in Saskatoon and nearby.' },
    timezone: 'America/Regina',
  });
  return [
    { profile: exampleProfile(now), kind: 'Heating, cooling & plumbing' },
    { profile: plumbing, kind: 'Plumbing' },
    { profile: heating, kind: 'Heating & cooling, with emergency calls on' },
  ];
}
