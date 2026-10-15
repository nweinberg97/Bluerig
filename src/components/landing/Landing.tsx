'use client';

// Bluerig's own landing page. Mobile first. It tells the story in order:
// what it is → a real example → how it works → what you can do from the truck →
// price → questions → get your free preview.

import { useState, type FormEvent, type ReactNode } from 'react';
import { Site } from '../Site';
import * as I from '../icons';
import { exampleProfile } from '@/lib/example';

export interface LandingProps {
  /** Where "See an example" goes. */
  exampleHref: string;
  onExample?: () => void;
  /** Sends a preview request. Return null on success or an error message. */
  requestPreview: (website: string, contact: string) => Promise<string | null>;
  signInHref?: string;
}

const STEPS: [ReactNode, string, string][] = [
  [<I.Leaf key="i" />, 'We build it for you', 'From your current website: your logo, colours, services and phone number. Nothing to fill in.'],
  [<I.Phone key="i" />, 'You get a link by text', 'Open it on your phone. That’s your new website. Change anything you like.'],
  [<I.Check key="i" />, 'Keep it and update it from the truck', 'When you’re happy, it goes live. After that, changes take seconds.'],
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

export function Landing({ exampleHref, onExample, requestPreview, signInHref }: LandingProps) {
  const example = exampleProfile();
  const [site, setSite] = useState('');
  const [contact, setContact] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('busy');
    setErr('');
    const problem = await requestPreview(site, contact);
    if (problem) {
      setErr(problem);
      setState('idle');
    } else setState('done');
  }
  const exampleLink = (cls: string, label: string) => (
    <a
      className={cls}
      href={exampleHref}
      onClick={(e) => {
        if (onExample) {
          e.preventDefault();
          onExample();
        }
      }}
    >
      {label}
    </a>
  );

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
          <div className="lp-ctas">
            {exampleLink('lp-btn primary', 'See an example')}
            <a className="lp-btn" href="#preview">Get my free preview</a>
          </div>
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
        {exampleLink('lp-btn primary wide', 'Try it on the example')}
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

      <section className="lp-sec lp-cta" id="preview">
        <h2>Get your free preview</h2>
        <p className="lp-lead">Tell us your current website. We’ll text you a link to your new one.</p>
        {state === 'done' ? (
          <p className="lp-done">Thanks! We’ll build your preview and text you the link.</p>
        ) : (
          <form className="lp-form" onSubmit={submit}>
            <label>
              Your current website
              <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="yourshop.ca" required autoComplete="url" inputMode="url" />
            </label>
            <label>
              Your mobile number or email
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="604-555-0123" required autoComplete="tel" />
            </label>
            {err && <p className="lp-err">{err}</p>}
            <button className="lp-btn primary wide" disabled={state === 'busy'}>{state === 'busy' ? 'Sending…' : 'Get my free preview'}</button>
          </form>
        )}
      </section>

      <footer className="lp-foot">
        <span className="lp-logo"><span className="k"><i /></span>Bluerig</span>
        <span>Websites for the trades, made in Canada.</span>
      </footer>
    </main>
  );
}
