// Answers the app's API calls in the browser, using the same rules as the server.
import { publishChecks, markPhotoRights } from '../src/lib/checks';
import { changedKeys, EDITABLE_KEYS, mergeFields, type ProfileKey } from '../src/lib/profile';
import { parseRules } from '../src/lib/parse-rules';
import { pruneExpired } from '../src/lib/time';
import { renderPromo } from '../src/lib/promo';
import { reviewRequestText, toE164 } from '../src/lib/reviews';
import { setIn } from '../src/components/editor/useDraft';
import { store } from './store';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (error: string, status = 400, extra = {}) => json({ ok: false, error, ...extra }, status);
export const SITE_URL = 'https://northline.bluerig.ca';

async function handle(path: string, body: Record<string, unknown>): Promise<Response> {
  const s = store.get();
  await new Promise((r) => setTimeout(r, 120)); // feel like a network
  if (path === '/api/leads') {
    const lead = { id: Date.now(), name: String(body.name), phone: String(body.phone), town: String(body.town ?? '') || null, message: String(body.message), urgency: (['now', 'soon', 'quote'].includes(String(body.urgency)) ? body.urgency : 'soon') as 'now' | 'soon' | 'quote', handled: false, created_at: new Date().toISOString() };
    store.set({ leads: [lead, ...s.leads] });
    return json({ ok: true });
  }
  const m = path.match(/^\/api\/businesses\/demo\/([a-z-]+)$/);
  if (!m) return fail('Not in the demo', 404);
  switch (m[1]) {
    case 'draft': {
      const p = (body.path as string[]) ?? [];
      store.set({ draft: setIn(s.draft, p, body.value) });
      return json({ ok: true });
    }
    case 'parse': {
      const r = parseRules(String(body.text ?? ''), s.draft, new Date());
      return r ? json({ ok: true, result: r }) : fail('Not sure what to change. Try one of the buttons, or click the words on the page.', 422);
    }
    case 'publish': {
      const only = Array.isArray(body.only) ? (body.only as string[]).filter((k) => EDITABLE_KEYS.includes(k as ProfileKey)) as ProfileKey[] : null;
      const confirmed = new Set((body.confirmed as string[]) ?? []);
      let next = only ? mergeFields(s.published, s.draft, only) : s.draft;
      const c = publishChecks(next, s.published);
      if (c.blocking.length) return fail(c.blocking[0], 422);
      const open = c.confirm.filter((x) => !confirmed.has(x.id));
      if (open.length) return fail('Please check these first.', 409, { confirm: open });
      next = pruneExpired(markPhotoRights(next, [...confirmed]), new Date());
      const keys = changedKeys(s.published, next);
      const label = only ? `Quick update: ${only.join(', ')}` : keys.length ? `Updated ${keys.slice(0, 3).join(', ')}` : 'Published';
      store.set({
        published: next,
        draft: confirmed.size ? markPhotoRights(s.draft, [...confirmed]) : s.draft,
        versions: [{ id: Date.now(), label, at: new Date().toISOString(), profile: next }, ...s.versions],
      });
      return json({ ok: true, published: next, url: SITE_URL });
    }
    case 'restore': {
      const v = s.versions.find((x) => x.id === Number(body.versionId));
      if (!v) return fail('Not found', 404);
      store.set({ published: v.profile, draft: v.profile, versions: [{ id: Date.now(), label: 'Restored an earlier version', at: new Date().toISOString(), profile: v.profile }, ...s.versions] });
      return json({ ok: true, published: v.profile });
    }
    case 'review-request': {
      if (!toE164(String(body.phone ?? ''))) return fail('That doesn’t look like a mobile number.');
      const live = s.published ?? s.draft;
      if (!live.googlePlaceId && !live.reviewsUrl) return fail('Connect your Google listing first.');
      return json({ ok: true, preview: reviewRequestText(live, { firstName: String(body.firstName ?? ''), link: 'https://search.google.com/local/writereview?placeid=demo' }) });
    }
    case 'invite':
      return json({ ok: true });
    case 'history':
      return json({ ok: true, versions: s.versions.map((v) => ({ id: v.id, label: v.label, created_at: v.at })) });
  }
  return fail('Not in the demo', 404);
}

export function installMockApi() {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(url, 'https://demo.local');
    if (u.pathname.startsWith('/api/')) {
      let body: Record<string, unknown> = {};
      try {
        body = init?.body ? JSON.parse(String(init.body)) : {};
      } catch {
        /* none */
      }
      return handle(u.pathname, body);
    }
    return real(input, init);
  };
  // Promo downloads: build the file right here.
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as HTMLElement).closest('a[href*="/promo?"]') as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault();
      const q = new URL(a.getAttribute('href')!, 'https://demo.local').searchParams;
      const svg = renderPromo(store.get().published ?? store.get().draft, q.get('format') ?? 'post', {
        topic: q.get('topic') ?? 'brand',
        variant: Number(q.get('v') ?? 0),
        slide: Number(q.get('slide') ?? 0),
        side: q.get('side') === '1' ? 1 : 0,
        print: q.get('print') === '1',
        siteUrl: SITE_URL,
        content: q.get('content') ? JSON.parse(q.get('content')!) : undefined,
      });
      // Demo: show the file instead of downloading it.
      const box = document.createElement('div');
      box.className = 'demo-file';
      box.innerHTML = `<div class="demo-file-in"><p>In the app this downloads as ${q.get('print') === '1' ? 'a print-ready file with bleed' : 'a full-size image'}. Here’s what you’d get:</p>${svg.replace(/width="[^"]+" height="[^"]+"/, 'width="100%"')}<button type="button">Close</button></div>`;
      box.addEventListener('click', (ev) => {
        if (ev.target === box || (ev.target as HTMLElement).tagName === 'BUTTON') box.remove();
      });
      document.body.appendChild(box);
    },
    true,
  );
}
