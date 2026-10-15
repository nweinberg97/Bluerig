'use client';

import { Landing } from '@/components/landing/Landing';

export default function Home() {
  return (
    <Landing
      exampleHref="/example"
      signInHref="/login"
      buildPreview={async (website, contact) => {
        const r = await fetch('/api/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ website, contact }) }).catch(() => null);
        const j = r ? ((await r.json().catch(() => ({}))) as { previewPath?: string; error?: string }) : {};
        if (r?.ok && j.previewPath) {
          window.location.href = j.previewPath;
          return null;
        }
        return j.error ?? 'That didn’t go through. Please try again.';
      }}
    />
  );
}
