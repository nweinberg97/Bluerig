// A made-up shop for the demo. Not a real business.
import { newProfile, type BusinessProfile } from '../src/lib/profile';
import { addDays, localDate } from '../src/lib/time';

export function demoProfile(now = new Date()): BusinessProfile {
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
export function importedProfile(now = new Date()): BusinessProfile {
  const p = demoProfile(now);
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
