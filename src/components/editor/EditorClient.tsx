'use client';

// The editor, built phone-first for owners who don't use much software. It opens on
// their website. Three buttons at the bottom: Edit (tap anything on the page,
// including the emergency-calls strip, deals, prices and job photos), Flyers & posts,
// and More. A "Next" bar suggests one step at a time. Saving puts the change live
// straight away, with Undo, so there's no separate "publish" step to learn.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { BusinessProfile, ProfileKey } from '@/lib/profile';
import { formatPrice } from '@/lib/profile';
import type { ChangeProposal } from '@/lib/changes';
import type { Confirmation } from '@/lib/checks';
import { Site } from '../Site';
import * as I from '../icons';
import { PANELS, Shell, type PanelName } from './panels';
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
  const [editing, setEditing] = useState(false);
  const [sheet, setSheet] = useState(false);
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


  // ---------- inline typing on the page ----------
  const dRef = useRef(d);
  dRef.current = d;
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
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
      const share = (e.target as HTMLElement).closest('[data-share]') as HTMLElement | null;
      if (share) {
        e.preventDefault();
        e.stopPropagation();
        routerRef.current.push(`/edit/${id}/promote?topic=${encodeURIComponent(share.dataset.share!)}`);
        return;
      }
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
    setSheet(false);
    setOpen(panelFor(j.result.proposal));
  }

  const Panel = open ? PANELS[open.name] : null;
  const confirmLeft = Object.keys(d.draft.confirm).length;
  const p = d.draft;
  const more: [PanelName, ReactNode, string, string][] = [
    ['leads', <I.Chat key="i" />, 'Customer requests', leads.newCount ? `${leads.newCount} new` : 'From the form on your website'],
    ['hours', <I.Clock key="i" />, 'Hours and days off', 'Holidays, vacation, new hours'],
    ['brand', <I.Badge key="i" />, 'Logo, name and colours', p.brand.logoUrl ? 'Your logo is on the site' : 'Upload your logo'],
    ...(props.role !== 'editor' ? ([['invite', <I.Share key="i" />, 'Invite your team', 'Your office manager or crew can edit too']] as [PanelName, ReactNode, string, string][]) : []),
    ['history', <I.Hist key="i" />, 'Undo older changes', 'Every version is kept'],
  ];

  // One suggested next step at a time, in order.
  const next: { text: string; label: string; go: () => void } | null =
    confirmLeft > 0
      ? { text: `Check ${confirmLeft} things we copied from your old website.`, label: 'Check them', go: () => setOpen({ name: 'confirm' }) }
      : !live
        ? { text: 'Your website isn’t on the internet yet.', label: launching ? 'Putting it live…' : 'Put it live', go: () => void launch() }
        : leads.newCount > 0
          ? { text: `${leads.newCount} new customer request${leads.newCount === 1 ? '' : 's'} from your website.`, label: 'See them', go: () => setOpen({ name: 'leads' }) }
          : null;
  const pick = (name: PanelName, itemId?: string) => {
    setSheet(false);
    setOpen({ name, itemId });
  };

  return (
    <div className="ed3">
      <header className="ed3-top">
        <Link href="/dashboard" className="logo" aria-label="Bluerig home"><span className="k"><i /></span></Link>
        <span className="ed-doc">
          <b>{p.brand.name}</b>
          <small>
            <span className={`dot ${d.saving ? 'saving' : ''} ${live ? '' : 'off'}`} />
            {d.error || (d.saving ? 'Saving…' : live ? 'Your website is live' : 'Not live yet')}
          </small>
        </span>
        <div className="faces hide-sm" aria-label="People here now">
          {d.people.map((x) => (
            <span key={x.key} className="face" style={{ background: x.color }} title={`${x.name}${x.field ? ' is editing' : ' is here'}`}>{x.name[0]?.toUpperCase()}</span>
          ))}
        </div>
      </header>

      {next && !editing && (
        <div className="ed3-next" role="status">
          <span className="ed3-step">Next</span>
          <span className="grow">{next.text}</span>
          <button className="btn primary" onClick={next.go} disabled={launching}>{next.label}</button>
        </div>
      )}
      {editing && (
        <div className="ed3-hint" role="status">
          <span className="grow">Tap any <u>underlined words</u> to change them, or tap a section to change it. Changes save as you go.</span>
          <button className="btn primary" onClick={() => setEditing(false)}>Done</button>
        </div>
      )}

      <main className={`ed3-site ${editing ? 'is-editing' : ''}`} ref={canvas}>
        <Site profile={p} mode={editing ? 'edit' : 'live'} now={now} />
      </main>

      <nav className="ed3-dock" aria-label="What do you want to do?">
        <button className={editing ? 'on' : ''} aria-pressed={editing} onClick={() => { setEditing((v) => !v); setSheet(false); }}>
          <I.Pen />
          <span>{editing ? 'Done' : 'Edit'}</span>
        </button>
        <Link href={`/edit/${id}/promote`}>
          <I.Tag />
          <span>Flyers &amp; posts</span>
        </Link>
        <button onClick={() => setSheet(true)} aria-expanded={sheet}>
          <I.Badge />
          <span>More</span>
          {leads.newCount > 0 && <i className="badge">{leads.newCount}</i>}
        </button>
      </nav>

      {sheet && (
        <Shell title="More" close={() => setSheet(false)}>
          <form className="act ask" onSubmit={runCmd}>
            <label htmlFor="ask-input"><b>Something changed? Type it.</b></label>
            <div className="ask-row">
              <input id="ask-input" value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder={`e.g. ${EXAMPLES[ex % EXAMPLES.length]}`} autoComplete="off" />
              <button type="submit" className="btn primary">Go</button>
            </div>
          </form>
          <div className="more-list">
            {more.map(([name, icon, title, sub]) => (
              <button key={name} className="row" onClick={() => pick(name)}>
                <span className="ic">{icon}</span>
                <span className="grow"><b>{title}</b><small>{sub}</small></span>
                <span aria-hidden>›</span>
              </button>
            ))}
            {live && (
              <a className="row" href={props.siteUrl} target="_blank" rel="noopener">
                <span className="ic"><I.Eye /></span>
                <span className="grow"><b>Open my live website</b><small>{props.siteUrl.replace(/^https?:\/\//, '')}</small></span>
                <span aria-hidden>›</span>
              </a>
            )}
          </div>
        </Shell>
      )}

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
