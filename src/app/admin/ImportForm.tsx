'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function ImportForm() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();
  async function go(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const r = await fetch('/api/admin/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) router.push(`/admin/b/${j.id}`);
    else setErr(j.error ?? 'Something went wrong.');
  }
  return (
    <form className="card2" onSubmit={go}>
      <div className="importer">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="their-shop.ca" aria-label="Website address" required />
        <button className="btn primary big" disabled={busy}>{busy ? 'Reading their site… (up to 30 seconds)' : 'Build preview'}</button>
      </div>
      {err && <p className="err">{err}</p>}
      <p className="note">We respect robots.txt, read at most 5 pages, and never copy photos or reviews. The owner confirms anything we weren’t sure about before it goes live.</p>
    </form>
  );
}
