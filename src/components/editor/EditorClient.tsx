'use client';

// Desktop-first editor: the shop's real website, editable in place. Underlined words
// are typed straight into the page; blocks with a blue tag open a quick panel. Nothing
// is live until "Update website", and everything can be undone from History.

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { BusinessProfile, ProfileKey } from '@/lib/profile';
import type { ChangeProposal } from '@/lib/changes';
import type { Confirmation } from '@/lib/checks';
import { Site } from '../Site';
import * as I from '../icons';
import { PANELS, type PanelName } from './panels';
import { useDraft } from './useDraft';

export interface EditorProps {
  id: string;
  slug: string;
  siteUrl: string;
  previewUrl: string;
  live: boolean;
  role: string;
  me: { id: string; email: string | null };
  draft: BusinessProfile;
  published: BusinessProfile | null;
}

type Open = { name: PanelName; itemId?: string; prefill?: Record<string, unknown> } | null;

const EXAMPLES = ['“closed Dec 24 to 26”', '“diagnostic fee is now $119”', '“we now serve Burnaby”', '“emergency calls till tomorrow morning”', '“$50 off tune-ups until Nov 30”'];

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
  const [open, setOpen] = useState<Open>(null);
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [view, setView] = useState(false);
  const [toast, setToast] = useState<{ text: string; action?: [string, () => void] } | null>(null);
  const [cmd, setCmd] = useState('');
  const [ex, setEx] = useState(0);
  const [confirm, setConfirm] = useState<Confirmation[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [fbar, setFbar] = useState<{ top: number; left: number; label: string; n: number; max: number } | null>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const now = useRef(new Date()).current;
  const live = props.live || !!d.published;

  const say = useCallback((text: string, action?: [string, () => void]) => {
    setToast({ text, action });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const t = setInterval(() => setEx((x) => x + 1), 3500);
    return () => clearInterval(t);
  }, []);
  // Open the "things to check" list the first time an imported site is opened.
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
      if (path) d.commit(path, (el.textContent ?? '').trim());
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

  // ---------- type a change ----------
  async function runCmd(e?: FormEvent) {
    e?.preventDefault();
    if (!cmd.trim()) return;
    const r = await fetch(`/api/businesses/${id}/parse`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: cmd }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return say(j.error ?? 'Not sure what to change.');
    setCmd('');
    setOpen(panelFor(j.result.proposal));
    say(j.result.message);
  }

  // ---------- publish ----------
  async function publish(confirmed: string[] = []) {
    setPublishing(true);
    const r = await d.publish({ confirmed });
    setPublishing(false);
    if (r.ok) {
      setOpen(null);
      say('Your website is updated.', ['See it', () => window.open(props.siteUrl, '_blank')]);
    } else if (r.confirm?.length) {
      setConfirm(r.confirm);
      setOpen({ name: 'check' });
    } else say(r.error);
  }
  const saveLive = useCallback(
    async (keys: ProfileKey[]) => {
      const r = await d.publish({ only: keys });
      if (r.ok) return null;
      if (r.confirm?.length) {
        setConfirm(r.confirm);
        setOpen({ name: 'check' });
        return 'Check one thing first.';
      }
      return r.error;
    },
    [d],
  );

  const Panel = open ? PANELS[open.name] : null;
  const n = d.changes.length;
  const confirmLeft = Object.keys(d.draft.confirm).length;
  const emergencyOn = d.draft.availability.kind === 'emergency' && !!d.draft.availability.until && Date.parse(d.draft.availability.until) > Date.now();

  return (
    <div>
      <div className="ed-top">
        <div className="ed-bar">
          <div className="ed-who">
            <Link href="/dashboard" className="logo"><span className="k"><i /></span><span className="hide-sm">Bluerig</span></Link>
            <span className="vsep" />
            <span className="ed-doc">
              <b>{d.draft.brand.name} · website</b>
              <small>
                <span className={`dot ${d.saving ? 'saving' : ''}`} />
                {d.error || (d.saving ? 'Saving…' : 'Saved')} · {live ? <a href={props.siteUrl} target="_blank" rel="noopener">live</a> : 'not live yet'}
              </small>
            </span>
          </div>
          <div className="ed-tools">
            <div className="faces hide-sm" aria-label="People here now">
              {d.people.map((p) => (
                <span key={p.key} className="face" style={{ background: p.color }} title={`${p.name}${p.field ? ' is editing' : ''}`}>{p.name[0]?.toUpperCase()}</span>
              ))}
            </div>
            <div className="hide-sm" style={{ display: 'flex', gap: 4 }}>
              <button className={`btn ${device === 'desktop' ? 'on' : ''}`} onClick={() => setDevice('desktop')}>Desktop</button>
              <button className={`btn ${device === 'phone' ? 'on' : ''}`} onClick={() => setDevice('phone')}>Phone</button>
            </div>
            <Link className="btn show-sm" href={`/edit/${id}/quick`}><I.Siren />Quick updates</Link>
            {props.role !== 'editor' && <button className="btn" onClick={() => setOpen({ name: 'invite' })}><I.Share /><span className="hide-sm">Invite</span></button>}
            <Link className="btn" href={`/edit/${id}/promote`}><I.Tag /><span className="hide-sm">Promote</span></Link>
            <button className={`btn ${view ? 'on' : ''}`} onClick={() => setView((v) => !v)}>{view ? <I.Pen /> : <I.Eye />}<span className="hide-sm">{view ? 'Back to editing' : 'Customer view'}</span></button>
            {confirmLeft > 0 && <button className="btn" onClick={() => setOpen({ name: 'confirm' })}>Check {confirmLeft} things</button>}
            <button className="btn primary" disabled={(!n && live) || publishing} onClick={() => publish()}>
              {publishing ? 'Updating…' : live ? (n ? `Update website · ${n}` : 'Website up to date') : 'Put it live'}
            </button>
          </div>
        </div>
        {!view && (
          <div className="ed-quick">
            <div className="in">
              <form className="cmd" onSubmit={runCmd}>
                <I.Pen />
                <input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder={`Tell us what changed, like ${EXAMPLES[ex % EXAMPLES.length]}`} aria-label="Describe a change to your website" />
                <button type="submit">Update</button>
              </form>
              <button className={`qb hot ${emergencyOn ? 'on' : ''}`} onClick={() => setOpen({ name: 'status' })}><I.Siren />{emergencyOn ? 'Emergency mode on' : 'Emergency mode'}</button>
              <button className="qb" onClick={() => setOpen({ name: 'areas' })}><I.Map />Towns</button>
              <button className="qb" onClick={() => setOpen({ name: 'photos', itemId: 'new' })}><I.Camera />Post a job</button>
              <button className="qb" onClick={() => setOpen({ name: 'prices' })}><I.Dollar />Prices</button>
              <button className="qb" onClick={() => setOpen({ name: 'reviews' })}><I.Star />Reviews</button>
              <button className="qb" onClick={() => setOpen({ name: 'special' })}><I.Tag />Deal</button>
              <button className="qb" onClick={() => setOpen({ name: 'hours' })}><I.Clock />Hours</button>
              <button className="qb" onClick={() => setOpen({ name: 'brand' })}><I.Badge />Logo & name</button>
              <button className="qb hide-sm" onClick={() => setOpen({ name: 'history' })}><I.Hist />History</button>
            </div>
          </div>
        )}
      </div>

      <div className="ed-stage">
        <div className={`ed-canvas ${device}`} ref={canvas}>
          {device === 'desktop' && (
            <div className="chrome">
              <span className="url">{live ? props.siteUrl.replace(/^https?:\/\//, '') : 'Private draft · not on the internet yet'}</span>
            </div>
          )}
          <Site profile={d.draft} mode={view ? 'preview' : 'edit'} now={now} businessId={id} />
        </div>
      </div>

      {fbar && (
        <div className="fbar" style={{ top: fbar.top, left: fbar.left }}>
          <span>
            <b>{fbar.label}</b> · {fbar.n}/{fbar.max}
          </span>
          <span className="muted">Saves as you type</span>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => (document.activeElement as HTMLElement)?.blur()}>Done</button>
        </div>
      )}

      {Panel && open && (
        <Panel
          id={id}
          p={d.draft}
          now={new Date()}
          itemId={open.itemId}
          prefill={open.prefill}
          save={d.setField}
          saveLive={saveLive}
          live={live}
          confirm={confirm}
          onConfirmed={(ids) => publish(ids)}
          close={(msg) => {
            setOpen(null);
            if (msg) say(msg);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast.text}
          {toast.action && <button onClick={toast.action[1]}>{toast.action[0]}</button>}
        </div>
      )}
    </div>
  );
}

