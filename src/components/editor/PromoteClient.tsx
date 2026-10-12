'use client';

// Flyers, posts & signs. Step 1: pick what to make from pictures of the real designs.
// Step 2: pick a look and download. Everything else is tucked under "More options".

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { BusinessProfile } from '@/lib/profile';
import { CATEGORIES, FORMATS, pageCount, promoContent, promoTopics, renderPromo, socialCaption, type PromoCategory } from '@/lib/promo';
import * as I from '../icons';

const LOOKS = ['Dark', 'Light', 'Bold'];
const fit = (svg: string) => svg.replace(/width="[^"]+" height="[^"]+"/, 'width="100%"');

export function PromoteClient({ id, profile, siteUrl, live }: { id: string; profile: BusinessProfile; siteUrl: string; live: boolean }) {
  const now = useMemo(() => new Date(), []);
  const topics = useMemo(() => promoTopics(profile, now), [profile, now]);
  const [cat, setCat] = useState<PromoCategory | null>(null);
  const [fmt, setFmt] = useState('post');
  const [topic, setTopic] = useState(topics.find((t) => t.id === 'special')?.id ?? topics[0].id);
  const [v, setV] = useState(0);
  const [head, setHead] = useState('');
  const [sub, setSub] = useState('');
  const [caption, setCaption] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const thumbs = useMemo(
    () =>
      Object.fromEntries(
        CATEGORIES.map((c) => {
          const f = FORMATS.find((x) => x.category === c.id)!;
          return [c.id, fit(renderPromo(profile, f.id, { topic: c.id === 'social' || c.id === 'flyer' ? topic : 'brand', variant: c.id === 'card' ? 1 : 0, siteUrl }))];
        }),
      ),
    [profile, siteUrl, topic],
  );

  const dl = (i: number, content: Record<string, string>, printable: boolean) =>
    `/api/businesses/${id}/promo?${new URLSearchParams({ format: fmt, topic, v: String(v), slide: String(i), side: String(i), print: printable ? '1' : '0', content: JSON.stringify(content) })}`;

  // ---------- step 1: what do you want to make? ----------
  if (!cat) {
    return (
      <main className="pr">
        <Link className="btn" href={`/edit/${id}`}>← Back to my website</Link>
        <h1>Flyers, posts &amp; signs</h1>
        <p className="lead">Ready-made with your logo, colours and phone number. Pick one, choose a look, download. Any print shop can print them.</p>
        {!live && <p className="lead" style={{ color: 'var(--warn)' }}>Your website isn’t live yet, so the web address on these won’t work until it is.</p>}
        <div className="pr-gallery">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className="pr-tile"
              onClick={() => {
                setCat(c.id);
                setFmt(FORMATS.find((x) => x.category === c.id)!.id);
                setV(0);
              }}
            >
              <span className={`pr-thumb ${c.id}`} dangerouslySetInnerHTML={{ __html: thumbs[c.id] }} />
              <b>{c.label}</b>
              <small>{c.hint}</small>
            </button>
          ))}
        </div>
      </main>
    );
  }

  // ---------- step 2: pick a look, download ----------
  const c = CATEGORIES.find((x) => x.id === cat)!;
  const f = FORMATS.find((x) => x.id === fmt)!;
  const sizes = FORMATS.filter((x) => x.category === cat);
  const words = cat === 'social' || cat === 'flyer';
  const base = promoContent(profile, topic);
  const content = { ...(head ? { head } : {}), ...(sub ? { sub } : {}) };
  const pages = pageCount(fmt);
  const svgs = Array.from({ length: pages }, (_, i) => renderPromo(profile, fmt, { topic, variant: v, siteUrl, slide: i, side: i as 0 | 1, content }));
  const printable = f.unit === 'in';
  const cap = caption ?? socialCaption(profile, { ...base, ...content }, siteUrl);
  const pageName = (i: number) => (f.sides ? (i ? 'Back' : 'Front') : `Picture ${i + 1}`);

  return (
    <main className="pr">
      <button className="btn" onClick={() => setCat(null)}>← All designs</button>
      <h1>{c.label}</h1>
      <p className="lead">{f.label} · {f.hint}{printable ? '. Print-ready, with the extra edge print shops ask for.' : '.'}</p>
      <div className="pr-grid">
        <div className="pr-view">
          <div className="pr-art">
            {svgs.map((s, i) => (
              <figure key={i} className="pv-wrap" style={{ width: pages > 1 ? (f.sides ? 380 : 260) : f.unit === 'px' ? (f.h > f.w ? 340 : 480) : Math.min(560, Math.max(320, f.w * 60)) }}>
                <div className="pv" dangerouslySetInnerHTML={{ __html: fit(s) }} />
                {pages > 1 && (
                  <figcaption>
                    {pageName(i)} · <a href={dl(i, content, printable)} download>Download</a>
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
        <div className="pr-ctl">
          <div className="field">
            <h3>Pick a look</h3>
            <div className="seg">
              {LOOKS.map((l, i) => <button key={l} aria-pressed={v === i} onClick={() => setV(i)}>{l}</button>)}
            </div>
          </div>
          {sizes.length > 1 && (
            <div className="field">
              <h3>Size</h3>
              <div className="seg">
                {sizes.map((x) => <button key={x.id} aria-pressed={fmt === x.id} onClick={() => setFmt(x.id)}>{x.label}</button>)}
              </div>
            </div>
          )}
          {words && (
            <label className="field">
              <h3>What’s it about?</h3>
              <select value={topic} onChange={(e) => { setTopic(e.target.value); setHead(''); setSub(''); setCaption(null); }}>
                {topics.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
          )}
          {pages === 1 ? (
            <a className="btn primary big" href={dl(0, content, printable)} download style={{ justifyContent: 'center' }}>Download</a>
          ) : (
            <p className="note" style={{ margin: 0 }}>Download each {f.sides ? 'side' : 'picture'} under its preview.</p>
          )}
          {words && (
            <details className="pr-more">
              <summary>More options</summary>
              <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
                {words && (
                  <>
                    <label className="field">Headline<input value={head || base.head} maxLength={70} onChange={(e) => setHead(e.target.value)} /></label>
                    <label className="field">Second line<input value={sub || base.sub} maxLength={140} onChange={(e) => setSub(e.target.value)} /></label>
                  </>
                )}
                {cat === 'social' && (
                  <label className="field">
                    Caption to paste with your post
                    <textarea value={cap} onChange={(e) => setCaption(e.target.value)} rows={6} />
                    <button
                      type="button"
                      className="btn light"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(cap);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        } catch {
                          /* select it by hand */
                        }
                      }}
                    >
                      <I.Chat />
                      {copied ? 'Copied' : 'Copy caption'}
                    </button>
                  </label>
                )}
              </div>
            </details>
          )}
          <p className="note">Your logo, name and colours come from your website.</p>
        </div>
      </div>
    </main>
  );
}
