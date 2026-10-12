import Link from 'next/link';
import { notFound } from 'next/navigation';
import { adminClient, currentUser, isStaff } from '@/lib/supabase/server';
import type { BusinessProfile } from '@/lib/profile';
import { ImportForm } from './ImportForm';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const user = await currentUser();
  if (!user || !isStaff(user.email)) notFound();
  const { data } = await adminClient().from('businesses').select('id, slug, status, draft, source_url, preview_token, created_at').order('created_at', { ascending: false }).limit(100);
  const rows = (data ?? []) as { id: string; slug: string; status: string; draft: BusinessProfile; source_url: string | null; preview_token: string; created_at: string }[];
  return (
    <main className="page">
      <Link href="/dashboard" className="logo" style={{ textDecoration: 'none' }}><span className="k"><i /></span>Bluerig admin</Link>
      <h1>Build a site from a website</h1>
      <p className="lead">Paste a shop’s current website. Bluerig reads a few public pages, builds a draft in their real logo and colours, and gives you a private preview link to send them. Anything it wasn’t sure about is marked for the owner to check.</p>
      <ImportForm />
      <div className="card2" style={{ marginTop: 18 }}>
        <h2>All sites</h2>
        <table className="tbl">
          <thead>
            <tr><th>Business</th><th>Status</th><th>From</th><th>Created</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/admin/b/${r.id}`}><b>{r.draft.brand.name}</b></Link><br /><small>{r.draft.city}, {r.draft.province}</small></td>
                <td><span className={`pill ${r.status}`}>{r.status}</span></td>
                <td>{r.source_url ? <a href={r.source_url} target="_blank" rel="noopener">{new URL(r.source_url).hostname}</a> : '—'}</td>
                <td>{new Date(r.created_at).toLocaleDateString('en-CA')}</td>
                <td style={{ textAlign: 'right' }}><Link href={`/p/${r.preview_token}`}>Preview</Link> · <Link href={`/edit/${r.id}`}>Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
