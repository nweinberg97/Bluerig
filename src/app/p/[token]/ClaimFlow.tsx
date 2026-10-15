'use client';

// The link a shop owner gets. They see their new website first. "Edit my website"
// opens a short, numbered sheet: 1) your email, 2) a code texted to the shop's
// phone, 3) you're in. Once claimed, the link is view-only for everyone else.

import { useState } from 'react';
import type { BusinessProfile } from '@/lib/profile';
import { PreviewExperience } from '@/components/preview/PreviewExperience';

export interface ClaimFlowProps {
  token: string;
  signedIn: boolean;
  claimed: boolean;
  canEdit: boolean;
  businessId: string;
  profile: BusinessProfile;
  /** Came back from the email link: open at step 2. */
  resume?: boolean;
}

export function ClaimFlow(props: ClaimFlowProps) {
  const { token, signedIn, claimed, canEdit, businessId, profile } = props;
  const [open, setOpen] = useState(!!props.resume && signedIn && !claimed);
  const name = profile.brand.name;

  if (claimed) {
    return (
      <PreviewExperience
        profile={profile}
        ribbon={<span><b>{name}</b> · claimed by the owner</span>}
        barTitle={canEdit ? 'This is your website.' : `This website belongs to ${name}.`}
        barText={canEdit ? 'Open the editor to make changes.' : 'This website has been claimed by its owner.'}
        action={canEdit ? { label: 'Open editor', onClick: () => (window.location.href = `/edit/${businessId}`) } : null}
      />
    );
  }
  return (
    <PreviewExperience
      profile={profile}
      ribbon={<span><b>Your new website</b>, made for {name} by Bluerig · <em>Preview, only you can see it</em></span>}
      barTitle="This is your new website."
      barText="Like it? Make changes and keep it."
      action={{ label: 'Edit my website', onClick: () => setOpen(true) }}
      sheetOpen={open}
      onCloseSheet={() => setOpen(false)}
      sheet={<ClaimSteps token={token} signedIn={signedIn} phone={profile.phone} name={name} />}
    />
  );
}

export function ClaimSteps({ token, signedIn, phone, name }: { token: string; signedIn: boolean; phone: string; name: string }) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'check-email' | 'send' | 'code'>(signedIn ? 'send' : 'email');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const n = step === 'email' || step === 'check-email' ? 1 : 2;

  async function sendEmailLink() {
    setBusy(true);
    setMsg('');
    const { browserClient } = await import('@/lib/supabase/browser');
    const { error } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/p/${token}?claim=1`)}` },
    });
    setBusy(false);
    if (error) setMsg('That didn’t work. Check the email address and try again.');
    else setStep('check-email');
  }
  async function sendCode(channel: 'sms' | 'call') {
    setBusy(true);
    setMsg('');
    const r = await fetch('/api/claim/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, channel }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok && j.alreadyOwner) return void (window.location.href = `/edit/${j.businessId}`);
    if (r.ok) {
      setStep('code');
      setMsg(channel === 'sms' ? `We texted a 6-digit code to ${phone}.` : `We’re calling ${phone} with a 6-digit code.`);
    } else setMsg(j.error ?? 'Something went wrong. Try again.');
  }
  async function verify() {
    setBusy(true);
    const r = await fetch('/api/claim/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, code }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return void (window.location.href = `/edit/${j.businessId}`);
    setBusy(false);
    setMsg(j.error ?? 'That code didn’t work.');
  }

  return (
    <div className="claim">
      <h2>Make it yours</h2>
      <p className="claim-sub">Two quick steps so we know it’s really {name}.</p>
      <ol className="claim-steps" aria-label="Steps">
        <li aria-current={n === 1}>Your email</li>
        <li aria-current={n === 2}>Code to your shop phone</li>
      </ol>
      {step === 'email' && (
        <>
          <label className="field">
            Your email
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <button className="btn primary big" disabled={busy || !email.includes('@')} onClick={sendEmailLink}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
          <p className="note">No password. You’ll use this email to sign in later.</p>
        </>
      )}
      {step === 'check-email' && (
        <div className="callout blue">Check your email at <b>{email}</b> and tap the link. It brings you right back here for step 2.</div>
      )}
      {step === 'send' && (
        <>
          <p>We’ll send a 6-digit code to the phone number on your website: <b>{phone || 'none listed'}</b>.</p>
          <button className="btn primary big" disabled={busy || !phone} onClick={() => sendCode('sms')}>{busy ? 'Sending…' : 'Text me the code'}</button>
          <button className="btn light" disabled={busy || !phone} onClick={() => sendCode('call')}>It’s a landline: call me instead</button>
        </>
      )}
      {step === 'code' && (
        <>
          <label className="field">
            6-digit code
            <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" aria-label="6-digit code" />
          </label>
          <button className="btn primary big" disabled={busy || code.length !== 6} onClick={verify}>{busy ? 'Checking…' : 'Done: open my editor'}</button>
          <button className="btn light" disabled={busy} onClick={() => setStep('send')}>Send a new code</button>
        </>
      )}
      {msg && <p className={step === 'code' && !/didn|wrong|expired|Too many|match|already/i.test(msg) ? 'note' : 'err'}>{msg}</p>}
    </div>
  );
}
