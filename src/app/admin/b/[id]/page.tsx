import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminClient, currentUser, isStaff } from '@/lib/supabase/server';
import type { BusinessProfile } from '@/lib/profile';

export const dynamic = 'force-dynamic';

type Sources = { sources: { field: string; value: string; source: string; sure: boolean }[]; warnings: string[]; skipped: string[] };

export default async function ImportReview({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !isStaff(user.email)) notFound();
  const { id } = await params;
  const { data } = await adminClient().from('businesses').select('id, slug, status, draft, preview_token, import_sources, source_url').eq('id', id).maybeSingle();
  if (!data) notFound();
  const p = data.draft as BusinessProfile;
  const s = (data.import_sources ?? { sources: [], warnings: [], skipped: [] }) as Sources;
  const app = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const previewUrl = `${app}/p/${data.preview_token}`;
  return (
    <main className="page">
      <Link href="/admin" className="btn">← All sites</Link>
      <h1>{p.brand.name}</h1>
      <p className="lead">Draft built from {data.source_url}. Check what we found, fix anything in the editor, then send the owner the preview link.</p>
      <div className="card2">
        <h2>Preview link to send</h2>
        <p style={{ wordBreak: 'break-all' }}><a href={`/p/${data.preview_token}`}>{previewUrl}</a></p>
        <p className="note">Private: not indexed by Google, and only people with the link can open it. The owner claims it with a code sent to the phone number on the site.</p>
        <p style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <Link className="btn light" href={`/edit/${data.id}`}>Fix things in the editor</Link>
          <Link className="btn light" href={`/p/${data.preview_token}`}>Open preview</Link>
        </p>
      </div>
      {s.warnings.length > 0 && (
        <div className="card2">
          <h2>Before you send it</h2>
          <ul>{s.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      <div className="card2">
        <h2>What we found, and where</h2>
        <table className="tbl">
          <thead><tr><th>Field</th><th>Value</th><th>Where from</th><th /></tr></thead>
          <tbody>
            {s.sources.map((r, i) => (
              <tr key={i}>
                <td>{r.field}</td>
                <td style={{ wordBreak: 'break-word' }}>{r.value}</td>
                <td style={{ wordBreak: 'break-word' }}><small>{r.source}</small></td>
                <td><span className={`pill ${r.sure ? 'sure' : 'unsure'}`}>{r.sure ? 'Sure' : 'Check'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {s.skipped.length > 0 && <p className="note">Skipped because robots.txt asked us to: {s.skipped.join(', ')}</p>}
      </div>
    </main>
  );
}
