'use client';

// The phone screen for the truck: five big buttons for the things that win or save
// jobs. Each one updates the live website straight away (only that one thing), so a
// tech never pushes someone else's half-finished edits.

import Link from 'next/link';
import { useCallback, useState, type ReactNode } from 'react';
import type { BusinessProfile, ProfileKey } from '@/lib/profile';
import type { Confirmation } from '@/lib/checks';
import * as I from '../icons';
import { PANELS, useSummaries, type PanelName } from './panels';
import { useDraft } from './useDraft';

export function QuickActions(props: { id: string; siteUrl: string; live: boolean; me: { id: string; email: string | null }; draft: BusinessProfile; published: BusinessProfile | null }) {
  const { id } = props;
  const d = useDraft(id, { draft: props.draft, published: props.published }, props.me);
  const [open, setOpen] = useState<{ name: PanelName; itemId?: string } | null>(null);
  const [confirm, setConfirm] = useState<Confirmation[]>([]);
  const [keys, setKeys] = useState<ProfileKey[]>([]);
  const [toast, setToast] = useState('');
  const live = props.live || !!d.published;
  // What people see is the live site; quick actions start from it.
  const base = d.draft;
  const sum = useSummaries(base, new Date());

  const saveLive = useCallback(
    async (k: ProfileKey[]) => {
      const r = await d.publish({ only: k });
      if (r.ok) return null;
      if (r.confirm?.length) {
        setKeys(k);
        setConfirm(r.confirm);
        setOpen({ name: 'check' });
        return 'Check one thing first.';
      }
      return r.error;
    },
    [d],
  );

  const Panel = open ? PANELS[open.name] : null;
  const card = (name: PanelName, icon: ReactNode, title: string, sub: string, cls = '', itemId?: string) => (
    <button className={`qa-card ${cls}`} onClick={() => setOpen({ name, itemId })}>
      <span className="ic">{icon}</span>
      <span className="grow">
        <b>{title}</b>
        <small>{sub}</small>
      </span>
      {name === 'status' ? <span className="toggle" aria-hidden /> : <span aria-hidden>›</span>}
    </button>
  );

  return (
    <main className="qa">
      <div className="qa-top">
        <Link href="/dashboard" className="logo"><span className="k"><i /></span></Link>
        <div className="grow">
          <b>{base.brand.name}</b>
          <small>{d.saving ? 'Saving…' : live ? 'Changes here go live right away' : 'Not live yet'}</small>
        </div>
        {live && <a className="btn" href={props.siteUrl} target="_blank" rel="noopener"><I.Eye />Site</a>}
      </div>
      <div className="qa-grid">
        {card('status', <I.Siren />, sum.emergencyOn ? 'Emergency mode is ON' : 'Emergency mode', sum.emergency, `em ${sum.emergencyOn ? 'on' : ''}`)}
        {card('photos', <I.Camera />, 'Post a job photo', sum.photos, '', 'new')}
        {card('areas', <I.Map />, 'Towns you serve', sum.areas)}
        {card('prices', <I.Dollar />, 'Prices', sum.prices)}
        {card('reviews', <I.Star />, 'Ask for a review', 'Text a customer your Google review link')}
        {card('special', <I.Tag />, 'Deal', sum.special)}
      </div>
      <div className="qa-foot">
        <Link className="btn" href={`/edit/${id}`}><I.Pen />Full editor</Link>
        <Link className="btn" href={`/edit/${id}/promote`}><I.Tag />Promote</Link>
      </div>
      {Panel && open && (
        <Panel
          id={id}
          p={base}
          now={new Date()}
          itemId={open.itemId}
          save={d.setField}
          saveLive={saveLive}
          live={live}
          confirm={confirm}
          onConfirmed={async (ids) => {
            const r = await d.publish({ only: keys, confirmed: ids });
            setOpen(null);
            setToast(r.ok ? 'Your website is updated.' : r.error);
          }}
          close={async (msg) => {
            const was = open.name;
            setOpen(null);
            // Deals saved from the phone go live too.
            if (live && was === 'special' && msg) {
              const e = await saveLive(['special']);
              setToast(e ?? 'Deal is live on your site.');
              return;
            }
            if (msg) setToast(msg);
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status" onClick={() => setToast('')}>
          {toast}
        </div>
      )}
    </main>
  );
}
