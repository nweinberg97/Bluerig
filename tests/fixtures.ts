import { newProfile } from '../src/lib/profile';
import type { BusinessProfile } from '../src/lib/profile';

/** A fictional shop used across tests. */
export function shop(over: Partial<BusinessProfile> = {}): BusinessProfile {
  return newProfile({
    brand: { name: 'Northline', tagline: 'Mechanical', logoUrl: null, primary: '#2E7D4A', accent: '#F7A928', ink: '#10251A' },
    phone: '604-555-0142',
    city: 'Port Coquitlam',
    province: 'BC',
    towns: ['Port Coquitlam', 'Coquitlam'],
    services: [{ id: 's1', name: 'Furnaces', blurb: 'Repairs and replacements.', icon: 'flame' }],
    prices: [{ id: 'p1', label: 'Diagnostic fee', amount: 89 }],
    ...over,
  });
}
// 2026-10-11 20:00 in Vancouver (UTC-7) = 2026-10-12T03:00Z
export const NOW = new Date('2026-10-12T03:00:00Z');
