'use client';

import { useState } from 'react';

/**
 * "This is my business": we send a code to the phone number listed on the site (by
 * text, or a voice call for landlines). Whoever answers that phone can claim it.
 */
export function ClaimBar({ token, signedIn, claimed, canEdit, phone, businessId }: { token: string; signedIn: boolean; claimed: boolean; canEdit: boolean; phone: string; businessId: string }) {
  const [step, setStep] = useState<'idle' | 'sent' | 'busy'>('idle');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');

  // Claimed: view only. Owners and their team get a way into the editor; nobody gets a claim button.
  if (claimed) return canEdit ? <a className="btn go" href={`/edit/${businessId}`}>Open editor</a> : null;
  if (!signedIn) return <a className="btn go" href={`/login?next=${encodeURIComponent(`/p/${token}`)}`}>This is my business</a>;

  async function start(channel: 'sms' | 'call') {
    setStep('busy');
    setMsg('');
    const r = await fetch('/api/claim/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, channel }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.alreadyOwner) {
      window.location.href = `/edit/${j.businessId}`;
      return;
    }
    setStep(r.ok ? 'sent' : 'idle');
    setMsg(r.ok ? `We ${channel === 'sms' ? 'texted' : 'are calling'} ${phone} with a 6-digit code.` : j.error ?? 'Something went wrong.');
  }
  async function verify() {
    setStep('busy');
    const r = await fetch('/api/claim/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, code }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) window.location.href = `/edit/${j.businessId}`;
    else if (r.status === 409) {
      setStep('idle');
      setMsg(j.error);
    }
    else {
      setStep('sent');
      setMsg(j.error ?? 'That code didn’t work.');
    }
  }

  if (step === 'idle')
    return (
      <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {msg && <span className="muted">{msg}</span>}
        <button className="btn go" onClick={() => start('sms')}>Text a code to {phone}</button>
        <button className="btn" onClick={() => start('call')}>Call me instead</button>
      </span>
    );
  return (
    <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <span className="muted">{msg}</span>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="6-digit code"
        aria-label="6-digit code"
        style={{ width: 130, borderRadius: 10, border: 0, padding: '8px 10px', fontSize: 16 }}
      />
      <button className="btn go" disabled={code.length !== 6 || step === 'busy'} onClick={verify}>Claim</button>
    </span>
  );
}
