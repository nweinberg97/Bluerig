'use client';

// Bluerig's own landing page. Mobile first. It tells the story in order:
// what it is → a real example → how it works → what you can do from the truck →
// price → questions → get your free preview.

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Site } from '../Site';
import * as I from '../icons';
import { exampleProfile, showcaseExamples } from '@/lib/example';
import type { BusinessProfile } from '@/lib/profile';

export interface LandingProps {
  /** Builds the preview and opens it. Returns an error message, or null when it's opening. */
  buildPreview: (website: string, contact: string) => Promise<string | null>;
  signInHref?: string;
  /** Pre-filled website (the guided example uses a made-up shop). */
  defaultSite?: string;
}

const STEPS: [ReactNode, string, string][] = [
  [<I.Leaf key="i" />, 'Type your current website', 'We build your new one from it: your logo, colours, services and phone number. Nothing to fill in.'],
  [<I.Phone key="i" />, 'Look at it, change anything', 'It’s private until you say so. Tap any words to change them.'],
  [<I.Check key="i" />, 'Make it yours with a code', 'We text a code to the phone number on your website, so only your shop can keep it. Then it goes live.'],
];

const TRUCK: [ReactNode, string, string][] = [
  [<I.Siren key="i" />, 'Taking emergency calls', 'One tap puts a red “Call now” bar on your site. It turns itself off.'],
  [<I.Camera key="i" />, 'Post a job photo', 'Snap it, add a line, done. Customers trust real work.'],
  [<I.Dollar key="i" />, 'Change a price', 'Diagnostic fee going up? Type the new number.'],
  [<I.Map key="i" />, 'Add a town', 'Want jobs in a new area? Add it, and Google sees it too.'],
  [<I.Star key="i" />, 'Ask for a review', 'Text a customer your Google review link after the job.'],
  [<I.Tag key="i" />, 'Flyers, posts & signs', 'Made from your website, in your colours. Print or post.'],
];

const FAQ: [string, string][] = [
  ['I’m not good with computers. Can I use this?', 'Yes. You tap the words you want to change and type. If you can send a text, you can update your website.'],
  ['What if I don’t like it?', 'Then nothing happens. Your preview isn’t on the internet, and your current website stays exactly as it is.'],
  ['Can I keep my web address?', 'Yes. When you’re ready, your new website goes live on the address you already have.'],
  ['Can my office manager or crew update it too?', 'Yes. Invite anyone by email. Everyone edits the same website.'],
];

const BUILDING = ['Reading your website', 'Finding your logo and colours', 'Finding your phone number and services', 'Building your new website'];

/** Type your website, then where to send the link. That's all. */
function PreviewForm({ buildPreview, id, defaultSite = '' }: { buildPreview: LandingProps['buildPreview']; id: string; defaultSite?: string }) {
  const [site, setSite] = useState(defaultSite);
  const [contact, setContact] = useState('');
  const [step, setStep] = useState<'site' | 'contact' | 'busy'>('site');
  const [tick, setTick] = useState(0);
  const [err, setErr] = useState('');
  useEffect(() => {
    if (step !== 'busy') return;
    setTick(0);
    const t = setInterval(() => setTick((n) => Math.min(n + 1, BUILDING.length - 1)), 1400);
    return () => clearInterval(t);
  }, [step]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (step === 'site') {
      if (!/\./.test(site)) return setErr('Type your current website, like yourshop.ca.');
      return setStep('contact');
    }
    setStep('busy');
    const problem = await buildPreview(site, contact);
    if (problem) {
      setErr(problem);
      setStep('contact');
    }
  }

  if (step === 'busy') {
    return (
      <div className="lp-building" aria-live="polite">
        <b>Building your new website…</b>
        <ul>
          {BUILDING.map((t, i) => (
            <li key={t} className={i < tick ? 'ok' : i === tick ? 'now' : ''}>
              {i < tick ? <I.Check /> : <span className="spin" />}
              {t}
            </li>
          ))}
        </ul>
        <small>This takes about 20 seconds.</small>
      </div>
    );
  }
  return (
    <form className="lp-form" onSubmit={submit}>
      {step === 'site' ? (
        <label htmlFor={`${id}-site`}>
          Your current website
          <input id={`${id}-site`} value={site} onChange={(e) => setSite(e.target.value)} placeholder="yourshop.ca" autoComplete="url" inputMode="url" />
        </label>
      ) : (
        <>
          <p className="lp-form-site">
            <b>{site}</b> <button type="button" className="lp-link" onClick={() => setStep('site')}>Change</button>
          </p>
          <label htmlFor={`${id}-contact`}>
            Where should we send your link?
            <input id={`${id}-contact`} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Mobile number or email" autoComplete="tel" autoFocus />
          </label>
        </>
      )}
      {err && <p className="lp-err">{err}</p>}
      <button className="lp-btn primary wide">{step === 'site' ? 'Build my new website' : 'Show me my new website'}</button>
      {step === 'contact' && <p className="lp-fine">Free. Only you can see it. Your current website doesn’t change.</p>}
    </form>
  );
}

/**
 * Full websites people can open and scroll. Until there are real client sites
 * (shown only with their permission), these are clearly labelled example designs.
 */
function Showcase() {
  const items = showcaseExamples();
  const [open, setOpen] = useState<BusinessProfile | null>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', h);
      document.body.style.overflow = '';
    };
  }, [open]);
  return (
    <section className="lp-sec">
      <h2>What your website could look like</h2>
      <p className="lp-lead">Example designs for made-up shops. Tap one to see the whole website.</p>
      <div className="lp-show">
        {items.map(({ profile, kind }) => (
          <button key={profile.brand.name} className="lp-show-card" onClick={() => setOpen(profile)}>
            <span className="lp-show-shot" aria-hidden>
              <Site profile={profile} mode="live" now={new Date()} />
            </span>
            <span className="lp-show-text">
              <b>{[profile.brand.name, profile.brand.tagline].filter(Boolean).join(' ')}</b>
              <small>{kind} · {profile.city}, {profile.province}</small>
              <span className="lp-show-go">See the whole website →</span>
            </span>
          </button>
        ))}
      </div>
      {open && (
        <div className="lp-viewer" role="dialog" aria-modal="true" aria-label={`${open.brand.name} example website`}>
          <div className="lp-viewer-bar">
            <span>
              <b>{open.brand.name}</b> · example design (made-up shop)
            </span>
            <button onClick={() => setOpen(null)}>Close</button>
          </div>
          <div className="lp-viewer-site">
            <Site profile={open} mode="live" now={new Date()} />
          </div>
        </div>
      )}
    </section>
  );
}

export function Landing({ buildPreview, signInHref, defaultSite }: LandingProps) {
  const example = exampleProfile();


  return (
    <main className="lp">
      <nav className="lp-nav">
        <span className="lp-logo"><span className="k"><i /></span>Bluerig</span>
        {signInHref && <a className="lp-signin" href={signInHref}>Sign in</a>}
      </nav>

      <section className="lp-hero">
        <div className="lp-copy">
          <p className="lp-eyebrow">For heating, cooling &amp; plumbing shops in Canada</p>
          <h1>Your new website is already built.</h1>
          <p className="lp-sub">We turn your current website into a fast, modern one. Then you keep it up to date from your phone, in seconds.</p>
          <PreviewForm buildPreview={buildPreview} id="hero" defaultSite={defaultSite} />
        </div>
        <div className="lp-phone" aria-label="Example: a new website for Northline Mechanical, a made-up shop">
          <div className="lp-phone-screen" aria-hidden>
            <Site profile={example} mode="live" now={new Date()} />
          </div>
          <p className="lp-caption">Example: a made-up shop</p>
        </div>
      </section>

      <section className="lp-sec">
        <h2>How it works</h2>
        <ol className="lp-steps">
          {STEPS.map(([icon, t, d], i) => (
            <li key={t}>
              <span className="lp-num">{i + 1}</span>
              <span className="lp-ic">{icon}</span>
              <b>{t}</b>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-sec">
        <h2>Things you can do from the truck</h2>
        <p className="lp-lead">Each one takes under a minute on your phone.</p>
        <div className="lp-grid">
          {TRUCK.map(([icon, t, d]) => (
            <div className="lp-item" key={t}>
              <span className="lp-ic">{icon}</span>
              <div>
                <b>{t}</b>
                <p>{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-sec lp-price">
        <h2>One simple price</h2>
        <div className="lp-price-card">
          <p className="lp-amount"><b>$15</b> a month</p>
          <p>billed yearly, or $19 month to month</p>
          <ul>
            <li><I.Check /> Your website, built for you</li>
            <li><I.Check /> Unlimited changes from your phone</li>
            <li><I.Check /> Customer requests texted to you</li>
            <li><I.Check /> Flyers, posts, cards and signs</li>
          </ul>
          <p className="lp-small">Your preview is free. You only pay if you keep it.</p>
        </div>
      </section>

      <section className="lp-sec">
        <h2>Questions</h2>
        <div className="lp-faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <Showcase />

      <section className="lp-sec lp-cta" id="preview">
        <h2>See your new website</h2>
        <p className="lp-lead">Type your current website. In about 20 seconds you’ll see your new one.</p>
        <PreviewForm buildPreview={buildPreview} id="end" defaultSite={defaultSite} />
      </section>

      <footer className="lp-foot">
        <span className="lp-logo"><span className="k"><i /></span>Bluerig</span>
        <span>Websites for the trades, made in Canada.</span>
      </footer>
    </main>
  );
}
