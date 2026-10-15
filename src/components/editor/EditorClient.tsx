'use client';

// The editor, built for owners who don't use much software. One place to start:
// "What do you want to do?" with three big actions and a "More" list, next to the
// real website (click any underlined words to change them). Saving puts the change
// live straight away, with Undo, so there's no separate "publish" step to learn.
// On a phone the same screen shows the actions first, with a switch to the site.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { BusinessProfile, ProfileKey } from '@/lib/profile';
import { formatPrice } from '@/lib/profile';
import type { ChangeProposal } from '@/lib/changes';
import type { Confirmation } from '@/lib/checks';
import { Site } from '../Site';
import * as I from '../icons';
import { PANELS, type PanelName } from './panels';
import { useDraft } from './useDraft';
import { useLeads } from './useLeads';

export interface EditorProps {
  id: string;
  slug: string;
  siteUrl: string;
  previewUrl: string;
  live: boolean;
  role: string;
  /** Phone: start on the list of actions (default) or on the site. */
  startOn?: 'actions' | 'site';
  me: { id: string; email: string | null };
  draft: BusinessProfile;
  published: BusinessProfile | null;
}

type Open = { name: PanelName; itemId?: string; prefill?: Record<string, unknown> } | null;

const EXAMPLES = ['closed Dec 24 to 26', 'diagnostic fee is now $119', 'we now serve Burnaby', '$50 off tune-ups until Nov 30'];

/** Turn a parsed change into the panel that shows it, pre-filled. */
function panelFor(c: ChangeProposal): Open {
  switch (c.kind) {
    case 'phone': return { name: 'phone', prefill: { phone: c.phone } };
    case 'name': return { name: 'brand' };
    case 'holiday': return { name: 'hours', prefill: { from: c.from, to: c.to, closed: c.closed } };
    case 'status': return { name: 'status', prefill: { status: c.status, until: c.until } };
    case 'special': return { name: 'special', prefill: { title: c.title, detail: c.detail, ends: c.ends } };
    case 'addArea': return { name: 'areas', prefill: { add: c.area } };
    case 'removeArea': return { name: 'areas', prefill: { remove: c.area } };
    case 'addService': return { name: 'service', itemId: 'new', prefill: { name: c.name } };
    case 'price': return { name: 'prices', prefill: { label: c.label, amount: c.amount } };
    case 'open': return { name: (c.panel === 'areas' ? 'areas' : c.panel) as PanelName };
  }
}

/** data-k ("services.<id>.name") → JSON path in the profile ("services", "2", "name"). */
function pathFor(p: BusinessProfile, k: string): string[] | null {
  const parts = k.split('.');
  if (parts[0] === 'services') {
    const i = p.services.findIndex((s) => s.id === parts[1]);
    return i < 0 ? null : ['services', String(i), parts[2]];
  }
  return parts;
}

export function EditorClient(props: EditorProps) {
  const { id, me } = props;
  const d = useDraft(id, { draft: props.draft, published: props.published }, me);
  const leads = useLeads(id, 60_000);
  const [open, setOpen] = useState<Open>(null);
  const [phoneFrame, setPhoneFrame] = useState(false);
  const [view, setView] = useState(false);
  const [mobileTab, setMobileTab] = useState<'actions' | 'site'>(props.startOn ?? 'actions');
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<{ text: string; action?: [string, () => void] } | null>(null);
  const [cmd, setCmd] = useState('');
  const [ex, setEx] = useState(0);
  const [confirm, setConfirm] = useState<{ items: Confirmation[]; keys: ProfileKey[] | null }>({ items: [], keys: null });
  const [launching, setLaunching] = useState(false);
  const [fbar, setFbar] = useState<{ top: number; left: number; label: string; n: number; max: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const now = useRef(new Date()).current;
  const live = props.live || !!d.published;

  const say = useCallback((text: string, action?: [string, () => void]) => setToast({ text, action }), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const t = setInterval(() => setEx((x) => x + 1), 3500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const h = (e: MouseEvent) => !(e.target as HTMLElement).closest('.menu') && setMenu(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [menu]);

  // ---------- saving = going live (with Undo) ----------
  const queue = useRef(new Set<ProfileKey>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMsg = useRef<string | null>(null);

  const publishKeys = useCallback(
    async (keys: ProfileKey[], confirmed: string[] = [], msg?: string | null) => {
      const before = keys.map((k) => [k, d.published ? d.published[k] : undefined] as const);
      const r = await d.publish({ only: keys, confirmed });
      if (r.ok) {
        setOpen(null);
        say(msg ?? 'Saved. It’s on your website now.', [
          'Undo',
          async () => {
            for (const [k, v] of before) if (v !== undefined) await d.setField(k, v as never);
            const u = await d.publish({ only: keys });
            say(u.ok ? 'Undone.' : 'Couldn’t undo. Try History under “More”.');
          },
        ]);
      } else if (r.confirm?.length) {
        setConfirm({ items: r.confirm, keys });
        setOpen({ name: 'check' });
      } else say(r.error);
    },
    [d, say],
  );

  /** Called after a field is saved. On a live site, puts it live (batched). */
  const goLive = useCallback(
    (key: ProfileKey, msg?: string) => {
      if (!live) return;
      queue.current.add(key);
      if (msg) lastMsg.current = msg;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const keys = [...queue.current];
        queue.current.clear();
        const m = lastMsg.current;
        lastMsg.current = null;
        void publishKeys(keys, [], m);
      }, 250);
    },
    [live, publishKeys],
  );
  const goLiveRef = useRef(goLive);
  goLiveRef.current = goLive;

  const save = useCallback(
    async <K extends ProfileKey>(key: K, value: BusinessProfile[K]) => {
      await d.setField(key, value);
      goLive(key);
    },
    [d, goLive],
  );

  async function launch(confirmed: string[] = []) {
    setLaunching(true);
    const r = await d.publish({ confirmed });
    setLaunching(false);
    if (r.ok) {
      setOpen(null);
      say('Your website is live.', ['See it', () => window.open(props.siteUrl, '_blank')]);
    } else if (r.confirm?.length) {
      setConfirm({ items: r.confirm, keys: null });
      setOpen({ name: 'check' });
    } else say(r.error);
  }

  // Imported sites: show what to check the first time.
  useEffect(() => {
    if (Object.keys(props.draft.confirm).length && !props.published) setOpen({ name: 'confirm' });
  }, [props.draft.confirm, props.published]);

  // ---------- inline typing on the page ----------
  const dRef = useRef(d);
  dRef.current = d;
  useEffect(() => {
    const d = { get draft() { return dRef.current.draft; }, typeAt: (a: string[], b: string) => dRef.current.typeAt(a, b), commit: (a: string[], b: string) => dRef.current.commit(a, b), setFocus: (f: string | null) => dRef.current.setFocus(f) };
    const root = canvas.current;
    if (!root) return;
    const target = (e: Event) => (e.target as HTMLElement).closest?.('[data-k]') as HTMLElement | null;
    const place = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      const max = Number(el.dataset.max ?? 200);
      setFbar({ top: r.top - 44 < 120 ? r.bottom + 8 : r.top - 44, left: Math.max(8, Math.min(r.left, window.innerWidth - 300)), label: el.dataset.ph || 'Text', n: (el.textContent ?? '').length, max });
    };
    const onInput = (e: Event) => {
      const el = target(e);
      if (!el) return;
      const max = Number(el.dataset.max ?? 200);
      let text = el.textContent ?? '';
      if (text.length > max) {
        text = text.slice(0, max);
        el.textContent = text;
        const sel = window.getSelection();
        sel?.selectAllChildren(el);
        sel?.collapseToEnd();
      }
      const path = pathFor(d.draft, el.dataset.k!);
      if (path) d.typeAt(path, text);
      place(el);
    };
    const onFocus = (e: Event) => {
      const el = target(e);
      if (!el) return;
      d.setFocus(el.dataset.k!);
      place(el);
    };
    const onBlur = (e: Event) => {
      const el = target(e);
      if (!el) return;
      const path = pathFor(d.draft, el.dataset.k!);
      if (path) {
        d.commit(path, (el.textContent ?? '').trim());
        goLiveRef.current(path[0] as ProfileKey);
      }
      d.setFocus(null);
      setFbar(null);
    };
    const onKey = (e: KeyboardEvent) => {
      const el = target(e);
      if (el && e.key === 'Enter' && (el.dataset.single || !e.shiftKey)) {
        e.preventDefault();
        el.blur();
      }
      const blk = (e.target as HTMLElement).closest?.('[data-panel]') as HTMLElement | null;
      if (blk && !el && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        blk.click();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (target(e)) return;
      const blk = (e.target as HTMLElement).closest('[data-panel]') as HTMLElement | null;
      if (blk) {
        e.preventDefault();
        setOpen({ name: blk.dataset.panel as PanelName, itemId: blk.dataset.id });
        return;
      }
      // Links inside the page shouldn't navigate away while editing.
      if ((e.target as HTMLElement).closest('a')) e.preventDefault();
    };
    root.addEventListener('input', onInput);
    root.addEventListener('focusin', onFocus);
    root.addEventListener('focusout', onBlur);
    root.addEventListener('keydown', onKey);
    root.addEventListener('click', onClick);
    return () => {
      root.removeEventListener('input', onInput);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('focusout', onBlur);
      root.removeEventListener('keydown', onKey);
      root.removeEventListener('click', onClick);
    };
  }, []);

  // Show where teammates are.
  useEffect(() => {
    const root = canvas.current;
    if (!root) return;
    root.querySelectorAll('.collab-ring').forEach((n) => n.classList.remove('collab-ring'));
    for (const person of d.people) {
      if (!person.field) continue;
      const el = root.querySelector(`[data-k="${CSS.escape(person.field)}"]`) as HTMLElement | null;
      if (el) {
        el.classList.add('collab-ring');
        el.style.setProperty('--c', person.color);
        el.title = `${person.name} is editing`;
      }
    }
  }, [d.people, d.draft]);

  // ---------- "Something changed? Tell us." ----------
  async function runCmd(e?: FormEvent) {
    e?.preventDefault();
    if (!cmd.trim()) return;
    const r = await fetch(`/api/businesses/${id}/parse`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: cmd }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return say(j.error ?? 'Not sure what to change. Try one of the options below.');
    setCmd('');
    setOpen(panelFor(j.result.proposal));
  }

  const Panel = open ? PANELS[open.name] : null;
  const confirmLeft = Object.keys(d.draft.confirm).length;
  const p = d.draft;
  const emergencyOn = p.availability.kind !== 'normal' && !!p.availability.until && Date.parse(p.availability.until) > Date.now();
  const until = emergencyOn ? new Date(p.availability.until!).toLocaleString('en-CA', { timeZone: p.timezone, weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  const more: [PanelName, ReactNode, string, string][] = [
    ['leads', <I.Chat key="i" />, 'Customer requests', leads.newCount ? `${leads.newCount} new` : 'From the form on your website'],
    ['prices', <I.Dollar key="i" />, 'Prices', p.prices.length ? p.prices.slice(0, 2).map((x) => `${x.label} ${formatPrice(x)}`).join(' · ') : 'Add your diagnostic fee'],
    ['areas', <I.Map key="i" />, 'Towns you serve', `${p.towns.slice(0, 3).join(', ')}${p.towns.length > 3 ? ` +${p.towns.length - 3}` : ''}`],
    ['special', <I.Tag key="i" />, 'Post a deal', p.special ? p.special.title : 'Like a tune-up special'],
    ['hours', <I.Clock key="i" />, 'Hours and days off', 'Holidays, vacation, new hours'],
    ['reviews', <I.Star key="i" />, 'Ask for a review', 'Text a customer your Google link'],
    ['brand', <I.Badge key="i" />, 'Logo, name and colours', p.brand.logoUrl ? 'Your logo is on the site' : 'Upload your logo'],
  ];

  return (
    <div className="ed2">
      <header className="ed-top">
        <div className="ed-bar">
          <div className="ed-who">
            <Link href="/dashboard" className="logo" aria-label="Bluerig home"><span className="k"><i /></span></Link>
            <span className="ed-doc">
              <b>{p.brand.name}</b>
              <small>
                <span className={`dot ${d.saving ? 'saving' : ''} ${live ? '' : 'off'}`} />
                {d.error || (d.saving ? 'Saving…' : live ? 'Your website is live' : 'Not live yet')}
              </small>
            </span>
          </div>
          <div className="ed-tools">
            <div className="faces hide-sm" aria-label="People here now">
              {d.people.map((x) => (
                <span key={x.key} className="face" style={{ background: x.color }} title={`${x.name}${x.field ? ' is editing' : ' is here'}`}>{x.name[0]?.toUpperCase()}</span>
              ))}
            </div>
            <button className={`btn ${view ? 'on' : ''} hide-sm`} onClick={() => setView((v) => !v)}>
              {view ? <I.Pen /> : <I.Eye />}
              {view ? 'Back to editing' : 'Customer view'}
            </button>
            <Link className="btn" href={`/edit/${id}/promote`}><I.Tag /><span>Flyers &amp; posts</span></Link>
            <div className="menu">
              <button className="btn" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>More ▾</button>
              {menu && (
                <div className="menu-list" role="menu">
                  {props.role !== 'editor' && <button role="menuitem" onClick={() => { setMenu(false); setOpen({ name: 'invite' }); }}><I.Share />Invite your team</button>}
                  <button role="menuitem" onClick={() => { setMenu(false); setOpen({ name: 'history' }); }}><I.Hist />Undo older changes</button>
                  <button role="menuitem" className="hide-sm" onClick={() => { setMenu(false); setPhoneFrame((f) => !f); }}><I.Eye />{phoneFrame ? 'Show at full size' : 'Preview on a phone'}</button>
                  {live && <a role="menuitem" href={props.siteUrl} target="_blank" rel="noopener"><I.Eye />Open my live website</a>}
                </div>
              )}
            </div>
            {!live && (
              <button className="btn primary" disabled={launching} onClick={() => launch()}>
                {launching ? 'Putting it live…' : 'Put my website live'}
              </button>
            )}
          </div>
        </div>
        <div className="mtabs show-sm" role="tablist">
          <button role="tab" aria-selected={mobileTab === 'actions'} onClick={() => setMobileTab('actions')}>Quick changes</button>
          <button role="tab" aria-selected={mobileTab === 'site'} onClick={() => setMobileTab('site')}>My website</button>
        </div>
      </header>

      <div className={`ed-body m-${mobileTab}`}>
        <aside className="ed-side" aria-label="What do you want to do?">
          <h2>What do you want to do?</h2>
          {leads.newCount > 0 && (
            <button className="act leads" onClick={() => setOpen({ name: 'leads' })}>
              <span className="ic"><I.Chat /></span>
              <span className="grow">
                <b>{leads.newCount} new customer request{leads.newCount === 1 ? '' : 's'}</b>
                <small>
                  {leads.newCount === 1
                    ? `From ${leads.leads.find((l) => !l.handled)?.name}`
                    : `From ${leads.leads.find((l) => !l.handled)?.name} and ${leads.newCount - 1} more`}
                </small>
              </span>
              <span aria-hidden>›</span>
            </button>
          )}
          {confirmLeft > 0 && (
            <button className="act check" onClick={() => setOpen({ name: 'confirm' })}>
              <span className="ic">!</span>
              <span className="grow"><b>Check {confirmLeft} things</b><small>We copied these from your old website.</small></span>
              <span aria-hidden>›</span>
            </button>
          )}
          <button className={`act em ${emergencyOn ? 'on' : ''}`} onClick={() => setOpen({ name: 'status' })} aria-pressed={emergencyOn}>
            <span className="ic"><I.Siren /></span>
            <span className="grow">
              <b>{emergencyOn ? (p.availability.kind === 'emergency' ? 'Emergency calls are ON' : 'Showing “booked up”') : 'Taking emergency calls?'}</b>
              <small>{emergencyOn ? `Turns off ${until}` : 'Put a red “Call now” bar on your site'}</small>
            </span>
            <span className="toggle" aria-hidden />
          </button>
          <button className="act" onClick={() => setOpen({ name: 'photos', itemId: 'new' })}>
            <span className="ic"><I.Camera /></span>
            <span className="grow"><b>Post a job photo</b><small>Show off work you just finished</small></span>
            <span aria-hidden>›</span>
          </button>
          <form className="act ask" onSubmit={runCmd}>
            <label htmlFor="ask-input"><b>Something changed? Tell us.</b></label>
            <div className="ask-row">
              <input id="ask-input" value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder={`e.g. ${EXAMPLES[ex % EXAMPLES.length]}`} autoComplete="off" />
              <button type="submit" className="btn primary">Go</button>
            </div>
            <small className="hide-sm">Or click any underlined words on your website to change them.</small>
          </form>
          <details className="more">
            <summary>More things you can change</summary>
            <div className="more-list">
              {more.map(([name, icon, title, sub]) => (
                <button key={name} className="row" onClick={() => setOpen({ name })}>
                  <span className="ic">{icon}</span>
                  <span className="grow"><b>{title}</b><small>{sub}</small></span>
                  <span aria-hidden>›</span>
                </button>
              ))}
            </div>
          </details>
        </aside>

        <main className="ed-stage">
          <p className="tapnote show-sm">Tap any underlined words to change them.</p>
          <div className={`ed-canvas ${phoneFrame ? 'phone' : 'desktop'}`} ref={canvas}>
            {!phoneFrame && (
              <div className="chrome">
                <span className="url">{live ? props.siteUrl.replace(/^https?:\/\//, '') : 'Not on the internet yet'}</span>
              </div>
            )}
            <Site profile={p} mode={view ? 'preview' : 'edit'} now={now} businessId={id} />
          </div>
        </main>
      </div>

      {fbar && (
        <div className="fbar" style={{ top: fbar.top, left: fbar.left }}>
          <span>{fbar.n}/{fbar.max} letters</span>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => (document.activeElement as HTMLElement)?.blur()}>Done</button>
        </div>
      )}

      {Panel && open && (
        <Panel
          id={id}
          p={p}
          now={new Date()}
          itemId={open.itemId}
          prefill={open.prefill}
          save={save}
          live={live}
          confirm={confirm.items}
          onConfirmed={(ids) => (confirm.keys ? publishKeys(confirm.keys, ids) : launch(ids))}
          close={(msg) => {
            if (open.name === 'leads') void leads.reload();
            setOpen(null);
            if (msg) {
              if (live) lastMsg.current = msg;
              else say('Saved. It goes live when you put your website live.');
            }
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast.text}
          {toast.action && <button onClick={() => { const a = toast.action![1]; setToast(null); void a(); }}>{toast.action[0]}</button>}
        </div>
      )}
    </div>
  );
}
