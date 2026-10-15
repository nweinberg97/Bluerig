'use client';

import { Landing } from '@/components/landing/Landing';

export default function Home() {
  return (
    <Landing
      exampleHref="/example"
      signInHref="/login"
      requestPreview={async (website, contact) => {
        const r = await fetch('/api/preview-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ website, contact }) }).catch(() => null);
        if (r?.ok) return null;
        const j = r ? await r.json().catch(() => ({})) : {};
        return (j as { error?: string }).error ?? 'That didn’t go through. Please try again.';
      }}
    />
  );
}
