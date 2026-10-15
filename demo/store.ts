// In-memory "backend" for the demo, kept in sessionStorage so a reload keeps edits.
import type { BusinessProfile } from '../src/lib/profile';
import { importedExample } from '../src/lib/example';

export interface DemoState {
  draft: BusinessProfile;
  /** null until the owner puts it live (the demo starts right after the import). */
  published: BusinessProfile | null;
  versions: { id: number; label: string; at: string; profile: BusinessProfile }[];
  leads: { id: number; name: string; phone: string | null; town: string | null; message: string; urgency: 'now' | 'soon' | 'quote'; handled: boolean; created_at: string }[];
}
const KEY = 'bluerig-demo-v3';

function fresh(): DemoState {
  const p = importedExample();
  const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
  // Made-up example requests, so the demo shows what owners see.
  const leads: DemoState['leads'] = [
    { id: 2, name: 'Priya S.', phone: '604-555-0187', town: 'Coquitlam', message: 'No heat since this morning. Furnace clicks but won’t light.', urgency: 'now', handled: false, created_at: ago(18) },
    { id: 1, name: 'Mark T.', phone: '604-555-0123', town: 'Port Moody', message: 'Looking for a quote on a heat pump for a 1,800 sq ft townhouse.', urgency: 'quote', handled: false, created_at: ago(60 * 26) },
  ];
  return { draft: p, published: null, versions: [], leads };
}

let state: DemoState = (() => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    /* storage unavailable */
  }
  return fresh();
})();

export const store = {
  uploads: new Map<string, string>(),
  get: () => state,
  set(next: Partial<DemoState>) {
    state = { ...state, ...next };
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* fine */
    }
    window.dispatchEvent(new Event('demo:store'));
  },
  reset() {
    state = fresh();
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* fine */
    }
    window.dispatchEvent(new Event('demo:store'));
  },
};
