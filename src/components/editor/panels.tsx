'use client';

// The quick panels. Each one edits one kind of fact in plain words. Used by the
// desktop editor (as a side panel) and the phone quick-actions screen (as a sheet).

import { useEffect, useState, type ReactNode } from 'react';
import type { BusinessProfile, DayHours, Job, Override, PriceItem, ProfileKey, Service } from '@/lib/profile';
import { DAYS, addArea, digits, formatPhone, isPostalArea, LIMITS, normalizeArea, uid } from '@/lib/profile';
import { FULL, fmtHour, fmtRange, localDate, untilFromPreset, type UntilPreset } from '@/lib/time';
import { TOWNS } from '@/lib/places-ca';
import type { Confirmation } from '@/lib/checks';
import { reviewLink } from '@/lib/reviews';
import { browserClient } from '@/lib/supabase/browser';
import { uploadImage } from './upload';
import { useLeads, type Lead } from './useLeads';
import * as I from '../icons';

export type PanelName = 'status' | 'special' | 'areas' | 'prices' | 'photos' | 'service' | 'hours' | 'brand' | 'phone' | 'reviews' | 'history' | 'invite' | 'check' | 'confirm' | 'leads';

export interface PanelProps {
  id: string;
  p: BusinessProfile;
  now: Date;
  itemId?: string;
  prefill?: Record<string, unknown>;
  /** Save a field. On a live site this goes live straight away (with Undo); otherwise it's kept for launch. */
  save: <K extends ProfileKey>(key: K, value: BusinessProfile[K]) => Promise<void> | void;
  close: (msg?: string) => void;
  /** For the publish-check panel. */
  confirm?: Confirmation[];
  onConfirmed?: (ids: string[]) => void;
  live: boolean;
}

export function Shell({ title, sub, children, footer, close }: { title: string; sub?: string; children: ReactNode; footer?: ReactNode; close: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [close]);
  return (
    <>
      <div className="rp-bg" onClick={close} />
      <aside className="rp" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div style={{ flex: 1 }}>
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          <button className="x" onClick={close} aria-label="Close">
            <I.X />
          </button>
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </aside>
    </>
  );
}

const Btn = ({ children, onClick, kind = 'light', disabled }: { children: ReactNode; onClick: () => void; kind?: string; disabled?: boolean }) => (
  <button type="button" className={`btn ${kind}`} onClick={onClick} disabled={disabled}>
    {children}
  </button>
);

// ---------- emergency mode / booked ----------

const PRESETS: [UntilPreset, string][] = [
  ['tonight', 'Until midnight'],
  ['morning', 'Until 7am tomorrow'],
  ['24h', 'For 24 hours'],
];

export function StatusPanel({ p, now, save, close, prefill }: PanelProps) {
  const isOn = p.availability.kind !== 'normal' && !!p.availability.until && Date.parse(p.availability.until) > now.getTime();
  const [kind, setKind] = useState<'normal' | 'booked' | 'emergency'>((prefill?.status as 'emergency') ?? (isOn ? p.availability.kind : 'emergency'));
  const [until, setUntil] = useState<UntilPreset>((prefill?.until as UntilPreset) ?? (kind === 'booked' ? 'week' : 'tonight'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function go(k = kind) {
    setBusy(true);
    const value = k === 'normal' ? { kind: 'normal' as const, until: null } : { kind: k, until: untilFromPreset(until, new Date(), p.timezone) };
    await save('availability', value);
    setBusy(false);
    close(k === 'emergency' ? 'Emergency calls are on. Your site shows a red “Call now” bar.' : k === 'booked' ? 'Your site now says you’re booked up.' : 'Emergency calls are off.');
  }
  return (
    <Shell
      title="Taking emergency calls?"
      sub="Turn this on during a cold snap or heat wave. Your site shows a red “Call now” bar, and it turns itself off when you say."
      close={() => close()}
      footer={
        <>
          {isOn && <Btn onClick={() => go('normal')} disabled={busy}>Turn off</Btn>}
          {kind !== 'normal' && (
            <Btn kind={kind === 'emergency' ? 'danger' : 'primary'} onClick={() => go()} disabled={busy}>
              {busy ? 'Saving…' : isOn ? 'Save' : 'Turn on'}
            </Btn>
          )}
        </>
      }
    >
      {isOn && (
        <div className={`callout ${p.availability.kind === 'emergency' ? 'red' : ''}`}>
          On now: {p.availability.kind === 'emergency' ? 'taking emergency calls' : 'booked up'} until{' '}
          {new Date(p.availability.until!).toLocaleString('en-CA', { timeZone: p.timezone, weekday: 'short', hour: 'numeric', minute: '2-digit' })}.
        </div>
      )}
      <div className="field">
        What should customers see?
        <div className="seg">
          <button type="button" className="hot" aria-pressed={kind === 'emergency'} onClick={() => { setKind('emergency'); setUntil('tonight'); }}>“Call now for emergencies”</button>
          <button type="button" aria-pressed={kind === 'booked'} onClick={() => { setKind('booked'); setUntil('week'); }}>“We’re booked up this week”</button>

        </div>
      </div>
      {kind !== 'normal' && (
        <div className="field">
          Turn it off
          <div className="seg">
            {(kind === 'booked' ? ([['week', 'End of this week'], ['24h', 'For 24 hours']] as [UntilPreset, string][]) : PRESETS).map(([k, l]) => (
              <button type="button" key={k} aria-pressed={until === k} onClick={() => setUntil(k)}>{l}</button>
            ))}
          </div>
        </div>
      )}
      {kind === 'emergency' && <p className="note">Your site will show a red bar at the very top: “Taking emergency calls right now · Tap to call {p.phone}”.</p>}
      {err && <p className="err">{err}</p>}
    </Shell>
  );
}

// ---------- deal ----------

export function SpecialPanel({ p, now, save, close, prefill }: PanelProps) {
  const today = localDate(now, p.timezone);
  const [title, setTitle] = useState((prefill?.title as string) ?? p.special?.title ?? '');
  const [detail, setDetail] = useState((prefill?.detail as string) ?? p.special?.detail ?? '');
  const [ends, setEnds] = useState((prefill?.ends as string) ?? p.special?.ends ?? '');
  const [err, setErr] = useState('');
  function ok() {
    if (!title.trim()) return setErr('Add a headline for the deal.');
    if (!ends) return setErr('Pick the last day, so the deal takes itself down.');
    if (ends < today) return setErr('That day has already passed.');
    void save('special', { title: title.trim(), detail: detail.trim() || undefined, ends });
    close('Your deal is on your website.');
  }
  return (
    <Shell
      title="Post a deal"
      sub="Shows across the top of your site and takes itself down after the last day."
      close={() => close()}
      footer={
        <>
          {p.special && <Btn onClick={() => { void save('special', null); close('Deal removed.'); }}>Remove deal</Btn>}
          <Btn kind="primary" onClick={ok}>Save deal</Btn>
        </>
      }
    >
      <label className="field">Headline<input value={title} maxLength={LIMITS.specialTitle} onChange={(e) => setTitle(e.target.value)} placeholder="$50 off furnace tune-ups" /></label>
      <label className="field">Small print (optional)<input value={detail} maxLength={LIMITS.specialDetail} onChange={(e) => setDetail(e.target.value)} placeholder="Book before the cold hits" /></label>
      <label className="field">Last day<input type="date" value={ends} min={today} onChange={(e) => setEnds(e.target.value)} /></label>
      {err && <p className="err">{err}</p>}
    </Shell>
  );
}

// ---------- service areas ----------

export function AreasPanel({ p, save, close, prefill }: PanelProps) {
  const [towns, setTowns] = useState(() => {
    let t = p.towns;
    if (prefill?.add) t = addArea(t, String(prefill.add));
    if (prefill?.remove) t = t.filter((x) => x.toLowerCase() !== String(prefill.remove).toLowerCase());
    return t;
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const sugg = (TOWNS[p.province] ?? []).filter((t) => !towns.includes(t)).slice(0, 10);
  function add(v = input) {
    const a = normalizeArea(v);
    if (!a) return;
    setTowns((t) => addArea(t, a));
    setInput('');
  }
  async function ok() {
    setBusy(true);
    await save('towns', towns);
    setBusy(false);
    close('Your towns are updated. Google sees them too.');
  }
  return (
    <Shell
      title="Towns you serve"
      sub="Type a town or a postal code. Google reads this list, so add the places you want jobs in."
      close={() => close()}
      footer={
<Btn kind="primary" onClick={ok} disabled={busy}>Save</Btn>
      }
    >
      <div className="field">
        Add a town or postal code
        <div className="row">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} placeholder="e.g. Burnaby or V5C" enterKeyHint="done" />
          <Btn kind="primary" onClick={() => add()}>Add</Btn>
        </div>
      </div>
      <div className="chips">
        {towns.map((t) => (
          <span className="chip" key={t}>
            {isPostalArea(t) ? <I.Map width={14} /> : <I.Pin width={13} />}
            {t}
            {t !== p.city && (
              <button type="button" aria-label={`Remove ${t}`} onClick={() => setTowns((x) => x.filter((y) => y !== t))}>
                <I.X />
              </button>
            )}
          </span>
        ))}
      </div>
      {sugg.length > 0 && (
        <div className="field">
          Nearby
          <div className="chips">
            {sugg.map((t) => (
              <button type="button" className="chip sug" key={t} onClick={() => add(t)}>+ {t}</button>
            ))}
          </div>
        </div>
      )}
      <p className="note">Postal codes are saved as the first 3 characters (like V3B), which is how Google groups areas.</p>
    </Shell>
  );
}

// ---------- prices ----------

export function PricesPanel({ p, save, close, prefill }: PanelProps) {
  const [rows, setRows] = useState<PriceItem[]>(() => {
    const r = p.prices.length ? p.prices : [{ id: uid(), label: 'Diagnostic fee', amount: null }];
    if (prefill?.label) {
      const want = String(prefill.label).toLowerCase();
      const hit = r.find((x) => x.label.toLowerCase() === want);
      if (hit) return r.map((x) => (x === hit ? { ...x, amount: prefill.amount as number | null } : x));
      return [...r, { id: uid(), label: String(prefill.label), amount: prefill.amount as number | null }];
    }
    return r;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (id: string, patch: Partial<PriceItem>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  async function ok() {
    const clean = rows.filter((x) => x.label.trim());
    if (clean.some((x) => x.amount !== null && !(x.amount >= 0))) return setErr('Check the prices: one isn’t a number.');
    setBusy(true);
    await save('prices', clean);
    setBusy(false);
    close('Your prices are updated.');
  }
  return (
    <Shell
      title="Prices"
      sub="Tap a number, change it, save. Leave it blank for “Call for a quote”."
      close={() => close()}
      footer={
<Btn kind="primary" onClick={ok} disabled={busy}>Save</Btn>
      }
    >
      <div className="list">
        {rows.map((x) => (
          <div className="li" key={x.id} style={{ flexWrap: 'wrap' }}>
            <div className="grow field" style={{ minWidth: 150 }}>
              <input value={x.label} maxLength={LIMITS.priceLabel} onChange={(e) => set(x.id, { label: e.target.value })} aria-label="What it is" placeholder="Diagnostic fee" />
            </div>
            <div className="field money">
              <div className="price-in">
                $
                <input
                  inputMode="decimal"
                  value={x.amount ?? ''}
                  placeholder="Quote"
                  aria-label={`Price for ${x.label}`}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d.]/g, '');
                    set(x.id, { amount: v === '' ? null : Number(v) });
                  }}
                />
              </div>
            </div>
            <button type="button" className="x" style={{ border: 0, background: 'transparent' }} aria-label={`Remove ${x.label}`} onClick={() => setRows((r) => r.filter((y) => y.id !== x.id))}>
              <I.X width={18} />
            </button>
            <div className="field" style={{ flexBasis: '100%' }}>
              <input value={x.note ?? ''} maxLength={LIMITS.priceNote} onChange={(e) => set(x.id, { note: e.target.value || undefined })} placeholder="Note (optional), e.g. credited to the repair" aria-label="Note" />
            </div>
          </div>
        ))}
      </div>
      {rows.length < LIMITS.prices && <Btn onClick={() => setRows((r) => [...r, { id: uid(), label: '', amount: null }])}>+ Add a price</Btn>}
      {err && <p className="err">{err}</p>}
    </Shell>
  );
}

// ---------- recent work photos ----------

export function PhotosPanel({ id, p, now, save, close, itemId }: PanelProps) {
  const editing = itemId && itemId !== 'new' ? p.jobs.find((j) => j.id === itemId) : undefined;
  const [after, setAfter] = useState<string | null>(editing?.photoUrl ?? null);
  const [before, setBefore] = useState<string | null>(editing?.beforeUrl ?? null);
  const [caption, setCaption] = useState(editing?.caption ?? '');
  const [town, setTown] = useState(editing?.town ?? p.city);
  const [rights, setRights] = useState(editing?.photoRights ?? false);
  const [busy, setBusy] = useState<'' | 'after' | 'before' | 'save'>('');
  const [err, setErr] = useState('');

  async function pick(which: 'after' | 'before', f?: File | null) {
    if (!f) return;
    setErr('');
    setBusy(which);
    try {
      const url = await uploadImage(id, f);
      (which === 'after' ? setAfter : setBefore)(url);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy('');
  }
  async function ok() {
    if (!after) return setErr('Add a photo of the finished job.');
    if (!caption.trim()) return setErr('Add one line about the job.');
    if (!rights) return setErr('Tick the box about the photo.');
    const job: Job = { id: editing?.id ?? uid(), photoUrl: after, beforeUrl: before, caption: caption.trim(), town: town || undefined, date: editing?.date ?? localDate(now, p.timezone), photoRights: true };
    const jobs = editing ? p.jobs.map((j) => (j.id === job.id ? job : j)) : [job, ...p.jobs].slice(0, LIMITS.jobs);
    setBusy('save');
    await save('jobs', jobs);
    setBusy('');
    close('Posted under “Recent work” on your site.');
  }
  const drop = (which: 'after' | 'before', url: string | null, label: string) => (
    <label className="drop">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" />
      ) : (
        <I.Camera width={30} />
      )}
      <b>{busy === which ? 'Uploading…' : url ? `Change ${label.toLowerCase()}` : label}</b>
      <input type="file" accept="image/*" hidden onChange={(e) => pick(which, e.target.files?.[0])} />
    </label>
  );
  return (
    <Shell
      title={editing ? 'Edit work photo' : 'Post a job'}
      sub="A real photo of a finished job. Customers trust it more than any stock photo."
      close={() => close()}
      footer={
        <>
          {editing && (
            <Btn onClick={() => { void save('jobs', p.jobs.filter((j) => j.id !== editing.id)); close('Photo removed.'); }}>Remove</Btn>
          )}
          <Btn kind="primary" onClick={ok} disabled={!!busy}>{busy === 'save' ? 'Posting…' : 'Post it'}</Btn>
        </>
      }
    >
      {drop('after', after, 'Photo of the finished job')}
      <details open={!!before}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Add a “before” photo (optional)</summary>
        <div style={{ marginTop: 10 }}>{drop('before', before, 'Before photo')}</div>
      </details>
      <label className="field">
        One line about it
        <input value={caption} maxLength={LIMITS.jobCaption} onChange={(e) => setCaption(e.target.value)} placeholder="New high-efficiency furnace in a 1970s split-level" />
      </label>
      <label className="field">
        Town
        <select value={town} onChange={(e) => setTown(e.target.value)}>
          {p.towns.filter((t) => !isPostalArea(t)).map((t) => <option key={t}>{t}</option>)}
          <option value="">Don’t say</option>
        </select>
      </label>
      <label className={`chk ${err && !rights ? 'req' : ''}`}>
        <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
        We took this photo, and it doesn’t show the customer, their house number or a licence plate.
      </label>
      {err && <p className="err">{err}</p>}
    </Shell>
  );
}

// ---------- one service ----------

export function ServicePanel({ id, p, save, close, itemId, prefill }: PanelProps) {
  const isNew = !itemId || itemId === 'new';
  const s = isNew ? undefined : p.services.find((x) => x.id === itemId);
  const [name, setName] = useState((prefill?.name as string) ?? s?.name ?? '');
  const [blurb, setBlurb] = useState(s?.blurb ?? '');
  const [photo, setPhoto] = useState<string | null>(s?.photoUrl ?? null);
  const [rights, setRights] = useState(s?.photoRights ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function pick(f?: File | null) {
    if (!f) return;
    setBusy(true);
    try {
      setPhoto(await uploadImage(id, f));
      setRights(false);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }
  function ok() {
    if (!name.trim()) return setErr('Give it a name.');
    if (photo && !rights) return setErr('Tick the box about the photo, or remove it.');
    const next: Service = { id: s?.id ?? uid(), name: name.trim(), blurb: blurb.trim(), icon: s?.icon ?? (/heat pump/i.test(name) ? 'pump' : /drain|pipe|sewer/i.test(name) ? 'pipe' : /water/i.test(name) ? 'drop' : 'wrench'), photoUrl: photo, photoRights: photo ? rights : undefined };
    void save('services', isNew ? [next, ...p.services] : p.services.map((x) => (x.id === next.id ? next : x)));
    close(isNew ? 'Service added.' : 'Service saved.');
  }
  return (
    <Shell
      title={isNew ? 'Add work you do' : name || 'Service'}
      close={() => close()}
      footer={
        <>
          {!isNew && <Btn onClick={() => { void save('services', p.services.filter((x) => x.id !== s!.id)); close('Service removed.'); }}>Remove</Btn>}
          <Btn kind="primary" onClick={ok} disabled={busy}>Save</Btn>
        </>
      }
    >
      <label className="field">Name<input value={name} maxLength={LIMITS.serviceName} onChange={(e) => setName(e.target.value)} placeholder="Heat pumps" /></label>
      <label className="field">A line about it<textarea value={blurb} maxLength={LIMITS.serviceBlurb} onChange={(e) => setBlurb(e.target.value)} placeholder="Installs and repairs, sized right for your home." /></label>
      <label className="drop">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" />
        ) : (
          <I.Camera width={28} />
        )}
        <b>{busy ? 'Uploading…' : photo ? 'Change photo' : 'Add a photo (optional)'}</b>
        <input type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {photo && (
        <>
          <label className="chk">
            <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} />
            We took this photo or have permission to use it.
          </label>
          <Btn onClick={() => setPhoto(null)}>Remove photo</Btn>
        </>
      )}
      {err && <p className="err">{err}</p>}
    </Shell>
  );
}

// ---------- hours and days off ----------

const HOUR_OPTS = Array.from({ length: 48 }, (_, i) => i / 2);

export function HoursPanel({ p, now, save, close, prefill }: PanelProps) {
  const [h, setH] = useState(p.hours);
  const [ovs, setOvs] = useState<Override[]>(() => {
    if (prefill?.from) return [...p.overrides, { id: uid(), from: String(prefill.from), to: String(prefill.to ?? prefill.from), closed: prefill.closed !== false, label: 'Holiday hours' }];
    return p.overrides;
  });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const today = localDate(now, p.timezone);
  const setDay = (d: (typeof DAYS)[number], v: DayHours) => setH((x) => ({ ...x, [d]: v }));
  function ok() {
    void save('hours', h);
    void save('overrides', ovs);
    close('Your hours are updated.');
  }
  return (
    <Shell title="Hours and days off" sub="Add holidays and days off here. Your normal hours come back by themselves after." close={() => close()} footer={<Btn kind="primary" onClick={ok}>Save hours</Btn>}>
      <div className="hours-grid">
        {DAYS.map((d) => {
          const v = h[d];
          return (
            <div className={`r ${v ? '' : 'off'}`} key={d}>
              <b>{d}</b>
              <select disabled={!v} value={v?.[0] ?? 8} onChange={(e) => setDay(d, [Number(e.target.value), v![1]])} aria-label={`${FULL[d]} opens`}>
                {HOUR_OPTS.map((x) => <option key={x} value={x}>{fmtHour(x)}</option>)}
              </select>
              <select disabled={!v} value={v?.[1] ?? 17} onChange={(e) => setDay(d, [v![0], Number(e.target.value)])} aria-label={`${FULL[d]} closes`}>
                {HOUR_OPTS.map((x) => <option key={x} value={x}>{fmtHour(x)}</option>)}
              </select>
              <label className="chk" style={{ fontSize: 13 }}>
                <input type="checkbox" checked={!v} onChange={(e) => setDay(d, e.target.checked ? null : [8, 17])} />
                Off
              </label>
            </div>
          );
        })}
      </div>
      <div className="field">
        Days off (holidays, vacation)
        <div className="row">
          <input type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="First day off" />
          <input type="date" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Last day off" />
          <Btn
            onClick={() => {
              if (!from) return;
              const t = to && to >= from ? to : from;
              setOvs((o) => [...o, { id: uid(), from, to: t, closed: true, label: 'Holiday hours' }]);
              setFrom('');
              setTo('');
            }}
          >
            Add
          </Btn>
        </div>
      </div>
      <div className="list">
        {ovs.filter((o) => o.to >= today).map((o) => (
          <div className="li" key={o.id}>
            <div className="grow">
              <b>{fmtRange(o.from, o.to)}</b>
              <small>{o.closed ? 'Closed' : `${fmtHour(o.open ?? 9)}–${fmtHour(o.close ?? 17)}`}</small>
            </div>
            <button type="button" className="btn light" onClick={() => setOvs((x) => x.filter((y) => y.id !== o.id))}>Remove</button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ---------- logo, name, colours ----------

export function BrandPanel({ id, p, save, close }: PanelProps) {
  const [b, setB] = useState(p.brand);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function pick(f?: File | null) {
    if (!f) return;
    setBusy(true);
    try {
      const url = await uploadImage(id, f, { max: 800, keepPng: true });
      setB((x) => ({ ...x, logoUrl: url }));
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }
  return (
    <Shell
      title="Logo, name and colours"
      sub="Used on your website and on every post, flyer, card and sign."
      close={() => close()}
      footer={<Btn kind="primary" onClick={() => { if (!b.name.trim()) return setErr('Your business needs a name.'); void save('brand', { ...b, name: b.name.trim() }); close('Saved.'); }}>Save</Btn>}
    >
      <label className="drop">
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logoUrl} alt="Your logo" />
        ) : (
          <I.Badge width={30} />
        )}
        <b>{busy ? 'Uploading…' : b.logoUrl ? 'Change logo' : 'Upload your logo'}</b>
        <small>PNG with a see-through background or SVG works best.</small>
        <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {b.logoUrl && <Btn onClick={() => setB((x) => ({ ...x, logoUrl: null }))}>Use the name instead of a logo</Btn>}
      <label className="field">Business name<input value={b.name} maxLength={LIMITS.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></label>
      <label className="field">Second line (optional)<input value={b.tagline} maxLength={LIMITS.tagline} onChange={(e) => setB({ ...b, tagline: e.target.value })} placeholder="Mechanical" /></label>
      <div className="swatches">
        <label>Main<input type="color" value={b.primary} onChange={(e) => setB({ ...b, primary: e.target.value.toUpperCase() })} /></label>
        <label>Accent<input type="color" value={b.accent} onChange={(e) => setB({ ...b, accent: e.target.value.toUpperCase() })} /></label>
        <label>Dark<input type="color" value={b.ink} onChange={(e) => setB({ ...b, ink: e.target.value.toUpperCase() })} /></label>
      </div>
      <p className="note">We adjust shades automatically so text stays easy to read.</p>
      {err && <p className="err">{err}</p>}
    </Shell>
  );
}

// ---------- phone number (typed twice) ----------

export function PhonePanel({ p, save, close, prefill }: PanelProps) {
  const [a, setA] = useState((prefill?.phone as string) ?? '');
  const [b, setB2] = useState('');
  const [err, setErr] = useState('');
  function ok() {
    if (digits(a).length < 10) return setErr('That doesn’t look like a full phone number.');
    if (digits(a) !== digits(b)) return setErr('The two numbers don’t match. Check for a typo.');
    void save('phone', formatPhone(a));
    close('Your phone number is updated.');
  }
  return (
    <Shell title="Phone number" sub={`Customers call this from your site. Now: ${p.phone || 'none'}.`} close={() => close()} footer={<Btn kind="primary" onClick={ok}>Save number</Btn>}>
      <label className="field">New number<input inputMode="tel" autoComplete="off" value={a} onChange={(e) => setA(e.target.value)} placeholder="604-555-0123" /></label>
      <label className="field">Type it again<input inputMode="tel" autoComplete="off" value={b} onChange={(e) => setB2(e.target.value)} onPaste={(e) => e.preventDefault()} /></label>
      {err && <p className="err">{err}</p>}
    </Shell>
  );
}

// ---------- reviews ----------

export function ReviewsPanel({ id, p, save, close }: PanelProps) {
  const [placeId, setPlaceId] = useState(p.googlePlaceId ?? '');
  const [first, setFirst] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const connected = !!(p.googlePlaceId || p.reviewsUrl);
  async function send() {
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/businesses/${id}/review-request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: first, phone, consent: consent ? 'yes' : '' }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setMsg({ ok: true, text: `Sent to ${phone}.` });
      setFirst('');
      setPhone('');
      setConsent(false);
    } else setMsg({ ok: false, text: j.error ?? 'Couldn’t send.' });
  }
  return (
    <Shell title="Reviews" sub="Text a customer your Google review link right after the job, while they’re happy." close={() => close()}>
      {connected ? (
        <>
          <label className="field">Customer’s first name (optional)<input value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="off" /></label>
          <label className="field">Their mobile number<input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" placeholder="604-555-0123" /></label>
          <label className="chk">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            We just did work for this customer.
          </label>
          <div className="callout blue" style={{ whiteSpace: 'pre-wrap' }}>
            {`Hi${first ? ` ${first.split(' ')[0]}` : ''}, thanks for choosing ${p.brand.name}. If you have a minute, a Google review helps a lot: ${p.googlePlaceId ? reviewLink(p.googlePlaceId) : p.reviewsUrl}\n— ${p.brand.name} ${p.phone}. Reply STOP to opt out.`}
          </div>
          <Btn kind="primary" onClick={send} disabled={busy || !phone || !consent}>{busy ? 'Sending…' : 'Text the review link'}</Btn>
          {msg && <p className={msg.ok ? 'note' : 'err'}>{msg.text}</p>}
          <p className="note">Ask every customer, not just the happy ones. Google doesn’t allow picking. We never text anyone who replied STOP.</p>
        </>
      ) : (
        <div className="callout">Connect your Google listing below first, so we know where to send people.</div>
      )}
      <details open={!connected}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Google listing</summary>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <label className="field">
            Google Place ID
            <input value={placeId} onChange={(e) => setPlaceId(e.target.value.trim())} placeholder="ChIJ…" />
          </label>
          <p className="note">
            Find it by searching your business name on Google’s{' '}
            <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener">Place ID finder</a>. Your
            star rating and newest reviews then show on your site, credited to Google.
          </p>
          <Btn onClick={() => { void save('googlePlaceId', placeId || null); close('Google listing connected.'); }}>Save listing</Btn>
        </div>
      </details>
    </Shell>
  );
}

// ---------- history ----------

export function HistoryPanel({ id, close }: PanelProps) {
  const [rows, setRows] = useState<{ id: number; label: string; created_at: string }[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  useEffect(() => {
    void browserClient()
      .from('site_versions')
      .select('id, label, created_at')
      .eq('business_id', id)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setRows((data as typeof rows) ?? []));
  }, [id]);
  async function restore(v: number) {
    setBusy(v);
    const r = await fetch(`/api/businesses/${id}/restore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ versionId: v }) });
    setBusy(null);
    if (r.ok) window.location.reload();
  }
  return (
    <Shell title="History" sub="Every update is kept. Put any earlier version back with one click." close={() => close()}>
      {rows === null ? (
        <p className="note">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="note">Nothing published yet.</p>
      ) : (
        <div className="list">
          {rows.map((v, i) => (
            <div className="li" key={v.id}>
              <div className="grow">
                <b>{v.label}</b>
                <small>{new Date(v.created_at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}{i === 0 ? ' · live now' : ''}</small>
              </div>
              {i > 0 && <button className="btn light" onClick={() => restore(v.id)} disabled={busy !== null}>{busy === v.id ? 'Restoring…' : 'Put back'}</button>}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ---------- customer requests (leads) ----------

const URGENCY: Record<Lead['urgency'], [string, string]> = {
  now: ['Urgent', 'red'],
  soon: ['This week', ''],
  quote: ['Quote', ''],
};

function ago(iso: string, now: number) {
  const m = Math.round((now - Date.parse(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function LeadsPanel({ id, p, close }: PanelProps) {
  const { leads, markHandled, loading } = useLeads(id);
  const now = Date.now();
  const open = leads.filter((l) => !l.handled);
  const done = leads.filter((l) => l.handled);
  const card = (l: Lead) => (
    <div className={`lead ${l.handled ? 'done' : ''}`} key={l.id}>
      <div className="lead-top">
        <b>{l.name}</b>
        {!l.handled && <span className={`pill ${URGENCY[l.urgency][1]}`}>{URGENCY[l.urgency][0]}</span>}
        <small>{ago(l.created_at, now)}{l.town ? ` · ${l.town}` : ''}</small>
      </div>
      <p>{l.message}</p>
      <div className="lead-actions">
        {l.phone && <a className="btn light" href={`tel:${l.phone.replace(/[^\d+]/g, '')}`}>Call {l.phone}</a>}
        {!l.handled && <Btn kind="primary" onClick={() => markHandled(l.id)}>Mark handled</Btn>}
      </div>
    </div>
  );
  return (
    <Shell title="Customer requests" sub={`Sent from the form on your website. Each one was also texted to ${p.phone || 'your phone'}.`} close={() => close()}>
      {loading ? (
        <p className="note">Loading…</p>
      ) : leads.length === 0 ? (
        <p className="note">No requests yet. When a customer fills in the form on your website, it shows up here.</p>
      ) : (
        <>
          {open.length === 0 && <p className="note">You’re all caught up.</p>}
          <div className="list">{open.map(card)}</div>
          {done.length > 0 && (
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>Handled ({done.length})</summary>
              <div className="list" style={{ marginTop: 10 }}>{done.map(card)}</div>
            </details>
          )}
        </>
      )}
    </Shell>
  );
}

// ---------- invite ----------

export function InvitePanel({ id, close }: PanelProps) {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function go() {
    const r = await fetch(`/api/businesses/${id}/invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const j = await r.json().catch(() => ({}));
    setMsg(r.ok ? { ok: true, text: `Invite sent to ${email}. They’ll get an email with a link to start editing.` } : { ok: false, text: j.error ?? 'Couldn’t invite.' });
    if (r.ok) setEmail('');
  }
  return (
    <Shell title="Invite your team" sub="Your office manager, a tech, your kid who does the Instagram. Everyone edits the same site, live." close={() => close()}>
      <label className="field">Their email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></label>
      <Btn kind="primary" onClick={go} disabled={!email.includes('@')}>Send invite</Btn>
      {msg && <p className={msg.ok ? 'note' : 'err'}>{msg.text}</p>}
    </Shell>
  );
}

// ---------- publish checks ----------

export function CheckPanel({ confirm = [], onConfirmed, close }: PanelProps) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const all = confirm.every((c) => ticked.has(c.id));
  return (
    <Shell
      title="Quick check"
      sub="Customers rely on these. Tick each one that’s right."
      close={() => close()}
      footer={<Btn kind="primary" disabled={!all} onClick={() => onConfirmed?.([...ticked])}>Yes, all correct</Btn>}
    >
      {confirm.map((c) => (
        <label className="chk" key={c.id}>
          <input type="checkbox" checked={ticked.has(c.id)} onChange={(e) => setTicked((s) => { const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} />
          {c.text}
        </label>
      ))}
    </Shell>
  );
}

// ---------- things the importer wasn't sure about ----------

export function ConfirmPanel({ p, save, close }: PanelProps) {
  const items = Object.entries(p.confirm);
  const done = (k: string, factPatch?: Partial<BusinessProfile['facts']>) => {
    const next = { ...p.confirm };
    delete next[k as keyof typeof next];
    void save('confirm', next);
    if (factPatch) void save('facts', { ...p.facts, ...factPatch });
  };
  return (
    <Shell title="Things to check" sub="We built this from your old website. Please check these before it goes live." close={() => close()}>
      {items.length === 0 && <p className="note">All checked. Nice.</p>}
      {items.map(([k, it]) => (
        <div className="li" key={k} style={{ alignItems: 'start', flexDirection: 'column' }}>
          <b>{it!.label}</b>
          <small>{it!.detail}</small>
          {it!.source && <small>Found: {it!.source}</small>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
            {k === 'licence' ? (
              <>
                <button className="btn light" onClick={() => done(k, { licensedInsured: true })}>Yes, show it</button>
                <button className="btn light" onClick={() => done(k, { licensedInsured: false })}>Don’t show it</button>
              </>
            ) : k === 'emergency' ? (
              <>
                <button className="btn light" onClick={() => done(k, { emergency247: true })}>Yes, we do 24/7</button>
                <button className="btn light" onClick={() => done(k, { emergency247: false })}>No</button>
              </>
            ) : (
              <button className="btn light" onClick={() => done(k)}>Looks right</button>
            )}
          </div>
        </div>
      ))}
    </Shell>
  );
}

export const PANELS: Record<PanelName, (p: PanelProps) => ReactNode> = {
  status: StatusPanel,
  special: SpecialPanel,
  areas: AreasPanel,
  prices: PricesPanel,
  photos: PhotosPanel,
  service: ServicePanel,
  hours: HoursPanel,
  brand: BrandPanel,
  phone: PhonePanel,
  reviews: ReviewsPanel,
  history: HistoryPanel,
  invite: InvitePanel,
  check: CheckPanel,
  confirm: ConfirmPanel,
  leads: LeadsPanel,
};
