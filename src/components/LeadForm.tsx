'use client';

import { useState, type FormEvent } from 'react';

type Urgency = 'now' | 'soon' | 'quote';

export function LeadForm({ businessId, towns, shopName, disabled }: { businessId?: string; towns: string[]; shopName: string; disabled?: boolean }) {
  const [urg, setUrg] = useState<Urgency>('soon');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled || !businessId) {
      setError('This is a preview. The form starts working once the site is live.');
      setState('error');
      return;
    }
    const f = new FormData(e.currentTarget);
    setState('sending');
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId,
        name: f.get('name'),
        phone: f.get('phone'),
        town: f.get('town'),
        message: f.get('message'),
        urgency: urg,
        company_website: f.get('company_website'), // honeypot
      }),
    }).catch(() => null);
    if (res?.ok) setState('sent');
    else {
      const j = res ? await res.json().catch(() => ({})) : {};
      setError((j as { error?: string }).error ?? 'That didn’t go through. Please call instead.');
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div className="form">
        <div className="done">Request sent. {shopName} gets it as a text right away, and you’ll hear back soon.</div>
      </div>
    );
  }
  return (
    <form className="form" onSubmit={submit}>
      <div className="two">
        <label>
          Your name
          <input name="name" required maxLength={80} autoComplete="name" placeholder="First and last name" />
        </label>
        <label>
          Phone
          <input name="phone" required inputMode="tel" autoComplete="tel" maxLength={20} placeholder="604-…" />
        </label>
      </div>
      <label>
        Town
        <select name="town" defaultValue={towns[0]}>
          {towns.map((t) => (
            <option key={t}>{t}</option>
          ))}
          <option>Somewhere else</option>
        </select>
      </label>
      <label>
        What’s going on?
        <textarea name="message" required maxLength={1000} placeholder="e.g. Furnace is running but blowing cold air" />
      </label>
      <div className="hp" aria-hidden>
        <input tabIndex={-1} autoComplete="off" name="company_website" />
      </div>
      <div>
        <div className="urglbl">How urgent?</div>
        <div className="urg">
          {(
            [
              ['now', 'No heat or water now', 'em'],
              ['soon', 'This week', ''],
              ['quote', 'Just a quote', ''],
            ] as const
          ).map(([k, l, c]) => (
            <button key={k} type="button" className={`${urg === k ? 'on' : ''} ${c}`} aria-pressed={urg === k} onClick={() => setUrg(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      {state === 'error' && <p className="formerr">{error}</p>}
      <button className="send" type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send request'}
      </button>
    </form>
  );
}
