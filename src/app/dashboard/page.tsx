import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser, isStaff } from '@/lib/supabase/server';
import { myBusinesses } from '@/lib/server/db';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const list = await myBusinesses();
  if (list.length === 1 && !isStaff(user.email)) redirect(`/edit/${list[0].id}`);
  return (
    <main className="page">
      <span className="logo"><span className="k"><i /></span>Bluerig</span>
      <h1>Your websites</h1>
      <p className="lead">Signed in as {user.email}.</p>
      <div className="card2">
        {list.length === 0 ? (
          <p className="note">No websites yet. If Bluerig sent you a preview link, open it and choose “This is my business”.</p>
        ) : (
          <table className="tbl">
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td><b>{b.name}</b></td>
                  <td><span className={`pill ${b.status}`}>{b.status === 'live' ? 'Live' : 'Not live yet'}</span></td>
                  <td>{b.role}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/edit/${b.id}`}>Edit</Link> · <Link href={`/edit/${b.id}/quick`}>Phone</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {isStaff(user.email) && <p style={{ marginTop: 16 }}><Link className="btn" href="/admin">Bluerig admin</Link></p>}
    </main>
  );
}
