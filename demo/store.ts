// In-memory "backend" for the demo, kept in sessionStorage so a reload keeps edits.
import type { BusinessProfile } from '../src/lib/profile';
import { demoProfile } from './data';

export interface DemoState {
  draft: BusinessProfile;
  published: BusinessProfile;
  versions: { id: number; label: string; at: string; profile: BusinessProfile }[];
  leads: { name: string; phone: string; message: string; at: string }[];
}
const KEY = 'bluerig-demo-v1';

function fresh(): DemoState {
  const p = demoProfile();
  return { draft: p, published: p, versions: [{ id: 1, label: 'First version', at: new Date().toISOString(), profile: p }], leads: [] };
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
