// Demo-only screens: making the link (Bluerig's side) and the owner's claim steps,
// simulated so the story can be clicked through with no backend.
import { useEffect, useState } from 'react';
import * as I from '../src/components/icons';

const FOUND = [
  'Reading their website…',
  'Found their logo and colours',
  'Found their phone number: 604-555-0142',
  'Found 6 services and 5 towns',
  'Built their new website',
];

export function MakeLink({ onOpen }: { onOpen: () => void }) {
  const [site, setSite] = useState('northline-mechanical.ca');
  const [step, setStep] = useState(-1);
  useEffect(() => {
    if (step < 0 || step >= FOUND.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [step]);
  const done = step >= FOUND.length;
  return (
    <main className="lp mk">
      <section className="lp-sec mk-in">
        <p className="lp-eyebrow">Your side</p>
        <h2>Make a link for a shop</h2>
        <p className="lp-lead">Paste the shop’s current website. Bluerig builds their new one and gives you a private link to text them.</p>
        <form
          className="lp-form"
          onSubmit={(e) => {
            e.preventDefault();
            setStep(0);
          }}
        >
          <label>
            Their current website
            <input value={site} onChange={(e) => setSite(e.target.value)} inputMode="url" />
          </label>
          <button className="lp-btn primary wide" disabled={step >= 0 && !done}>{step < 0 ? 'Build their website' : done ? 'Built' : 'Building…'}</button>
        </form>
        {step >= 0 && (
          <ul className="mk-steps" aria-live="polite">
            {FOUND.slice(0, Math.min(step + 1, FOUND.length)).map((t, i) => (
              <li key={t} className={i < step || done ? 'ok' : ''}>
                {i < step || done ? <I.Check /> : <span className="spin" />}
                {i === 0 && (i < step || done) ? 'Read their website' : t}
              </li>
            ))}
          </ul>
        )}
        {done && (
          <div className="mk-ready">
            <h3>Their link is ready</h3>
            <p className="mk-link">bluerig.ca/p/7f3k9q</p>
            <p className="lp-lead" style={{ margin: 0 }}>Text it to the owner. For example:</p>
            <div className="mk-text">Hi, it’s [your name] from Bluerig. I made Northline Mechanical a new website, free to look at: bluerig.ca/p/7f3k9q</div>
            <button className="lp-btn primary wide" onClick={onOpen}>Open it like the owner would →</button>
          </div>
        )}
      </section>
    </main>
  );
}

export function DemoClaim({ phone, onDone }: { phone: string; onDone: () => void }) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('owner@northline.example');
  const [code, setCode] = useState('');
  return (
    <div className="claim">
      <h2>Make it yours</h2>
      <p className="claim-sub">Two quick steps so we know it’s really Northline.</p>
      <ol className="claim-steps" aria-label="Steps">
        <li aria-current={step === 'email'}>Your email</li>
        <li aria-current={step === 'code'}>Code to your shop phone</li>
      </ol>
      {step === 'email' ? (
        <>
          <label className="field">
            Your email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn primary big" disabled={!email.includes('@')} onClick={() => setStep('code')}>Next</button>
          <p className="note">In the real app this emails a sign-in link. No password.</p>
        </>
      ) : (
        <>
          <p>We texted a 6-digit code to the phone number on the website: <b>{phone}</b>.</p>
          <label className="field">
            6-digit code
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="123456" />
          </label>
          <button className="btn primary big" disabled={code.length !== 6} onClick={onDone}>Done: open my editor</button>
          <p className="note">Demo: type any 6 digits.</p>
        </>
      )}
    </div>
  );
}
