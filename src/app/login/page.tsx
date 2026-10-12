'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { browserClient } from '@/lib/supabase/browser';

function LoginForm() {
  const next = useSearchParams().get('next') ?? '/dashboard';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  async function send(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const { error } = await browserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) setErr('Couldn’t send the link. Check the email and try again.');
    else setSent(true);
  }
  return (
    <form className="login" onSubmit={send}>
      <span className="logo" style={{ color: '#111a22' }}><span className="k"><i /></span>Bluerig</span>
      {sent ? (
        <>
          <h1>Check your email</h1>
          <p className="note">We sent a sign-in link to {email}. Open it on this device.</p>
        </>
      ) : (
        <>
          <h1>Sign in</h1>
          <p className="note">No password. We’ll email you a link.</p>
          <label className="field">
            Email
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {err && <p className="err">{err}</p>}
          <button className="btn primary big" type="submit">Email me a link</button>
        </>
      )}
    </form>
  );
}

export default function Login() {
  return (
    <main className="center">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
