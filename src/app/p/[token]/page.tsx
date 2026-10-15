import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { byPreviewToken, isMember, ownerIds } from '@/lib/server/db';
import { currentUser } from '@/lib/supabase/server';
import { ClaimFlow } from './ClaimFlow';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Private preview · Bluerig', robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ claim?: string }> };

export default async function Preview({ params, searchParams }: Props) {
  const { token } = await params;
  const { claim } = await searchParams;
  const row = await byPreviewToken(token);
  if (!row) notFound();
  const user = await currentUser();
  const p = row.published ?? row.draft;
  // Once a business has an owner, this link stays viewable but never offers a claim.
  const claimed = row.status === 'live' || (await ownerIds(row.id)).length > 0;
  const canEdit = !!user && (await isMember(row.id, user.id));
  return (
    <main className="public">
      <ClaimFlow token={token} signedIn={!!user} claimed={claimed} canEdit={canEdit} businessId={row.id} profile={p} resume={claim === '1'} />
    </main>
  );
}
