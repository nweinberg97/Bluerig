'use client';

// Promote: designs made from the live website, in the shop's own logo and colours.
// Five categories: social media, flyers, business cards, magnets and yard signs.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { BusinessProfile } from '@/lib/profile';
import { CATEGORIES, FORMATS, pageCount, promoContent, promoTopics, renderPromo, socialCaption, type PromoCategory } from '@/lib/promo';
import * as I from '../icons';

const LOOKS = ['Dark', 'Light', 'Bold'];

export function PromoteClient({ id, profile, siteUrl, live }: { id: string; profile: BusinessProfile; siteUrl: string; live: boolean }) {
  const now = useMemo(() => new Date(), []);
  const topics = useMemo(() => promoTopics(profile, now), [profile, now]);
  const [cat, setCat] = useState<PromoCategory>('social');
  const [fmt, setFmt] = useState('post');
  const [topic, setTopic] = useState(topics[0].id);
  const [v, setV] = useState(0);
  const [head, setHead] = useState('');
  const [sub, setSub] = useState('');
  const [copied, setCopied] = useState(false);
  const f = FORMATS.find((x) => x.id === fmt)!;
  const base = promoContent(profile, topic);
  const content = { ...(head ? { head } : {}), ...(sub ? { sub } : {}) };
  const pages = pageCount(fmt);
  const svgs = Array.from({ length: pages }, (_, i) => renderPromo(profile, fmt, { topic, variant: v, siteUrl, slide: i, side: (i as 0 | 1), content }));
  const [caption, setCaption] = useState<string | null>(null);
  const cap = caption ?? socialCaption(profile, { ...base, ...content }, siteUrl);
  const printable = f.unit === 'in';
  const per = f.unit === 'px' ? (pages > 1 ? 300 : f.h > f.w ? 340 : 480) : Math.min(560, Math.max(300, f.w * 60));

  function pickCat(c: PromoCategory) {
    setCat(c);
    setFmt(FORMATS.find((x) => x.category === c)!.id);
  }
  const dl = (i: number) =>
    `/api/businesses/${id}/promo?${new URLSearchParams({ format: fmt, topic, v: String(v), slide: String(i), side: String(i), print: printable ? '1' : '0', content: JSON.stringify(content) })}`;

  return (
    <main className="pr">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <Link className="btn" href={`/edit/${id}`}>← Back to your website</Link>
      </div>
      <h1>Promote</h1>
      <p className="lead">Made from your website, in your logo and colours. Pick what to promote, choose a look, then download. Print files include the extra 1/8" edge print shops ask for.</p>
      {!live && <p className="lead" style={{ color: '#FFC266' }}>Your site isn’t live yet. Designs use your draft, and the web address won’t work until it’s live.</p>}
      <div className="pr-cats" role="tablist">
        {CATEGORIES.map((c) => (
          <button key={c.id} aria-pressed={cat === c.id} onClick={() => pickCat(c.id)}>
            {c.label}
            <small>{c.hint}</small>
          </button>
        ))}
      </div>
      <div className="pr-grid">
        <div className="pr-ctl">
          {FORMATS.filter((x) => x.category === cat).length > 1 && (
            <div className="field">
              <h3>Size</h3>
              <div className="seg">
                {FORMATS.filter((x) => x.category === cat).map((x) => (
                  <button key={x.id} aria-pressed={fmt === x.id} onClick={() => setFmt(x.id)}>{x.label}</button>
                ))}
              </div>
            </div>
          )}
          <p className="note" style={{ margin: 0 }}>{f.label}: {f.hint}</p>
          {(cat === 'social' || cat === 'flyer') && (
            <label className="field">
              <h3>What to promote</h3>
              <select value={topic} onChange={(e) => { setTopic(e.target.value); setHead(''); setSub(''); setCaption(null); }}>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
          )}
          <div className="field">
            <h3>Look</h3>
            <div className="seg">
              {LOOKS.map((l, i) => <button key={l} aria-pressed={v === i} onClick={() => setV(i)}>{l}</button>)}
            </div>
          </div>
          {(cat === 'social' || cat === 'flyer') && (
            <>
              <label className="field">Headline<input value={head || base.head} maxLength={70} onChange={(e) => setHead(e.target.value)} /></label>
              <label className="field">Second line<input value={sub || base.sub} maxLength={140} onChange={(e) => setSub(e.target.value)} /></label>
            </>
          )}
          <p className="note">Logo, name and colours come from your website. Change them there under “Logo &amp; name”.</p>
        </div>
        <div className="pr-view">
          <div className="pr-art">
            {svgs.map((s, i) => (
              <div key={i} className="pv" style={{ width: per }}>
                <div dangerouslySetInnerHTML={{ __html: s.replace(/width="[^"]+" height="[^"]+"/, 'width="100%"') }} />
              </div>
            ))}
          </div>
          <div className="pr-actions">
            {svgs.map((_, i) => (
              <a key={i} className="btn primary" href={dl(i)} download>
                Download{pages > 1 ? (f.sides ? (i ? ' back' : ' front') : ` picture ${i + 1}`) : ''}
              </a>
            ))}
            {printable && <span className="muted" style={{ alignSelf: 'center' }}>Print-ready file with bleed. Any local print shop can print it.</span>}
          </div>
          {cat === 'social' && (
            <div className="pr-cap">
              <label className="field" style={{ color: 'var(--stf)' }}>
                Caption
                <textarea value={cap} onChange={(e) => setCaption(e.target.value)} />
              </label>
              <button className="btn" onClick={async () => { try { await navigator.clipboard.writeText(cap); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* select manually */ } }}>
                <I.Chat />{copied ? 'Copied' : 'Copy caption'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
