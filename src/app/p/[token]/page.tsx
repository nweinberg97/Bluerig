import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Site } from '@/components/Site';
import { byPreviewToken, isMember, ownerIds } from '@/lib/server/db';
import { currentUser } from '@/lib/supabase/server';
import { ClaimBar } from './ClaimBar';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Private preview · Bluerig', robots: { index: false, follow: false } };

type Props = { params: Promise<{ token: string }> };

export default async function Preview({ params }: Props) {
  const { token } = await params;
  const row = await byPreviewToken(token);
  if (!row) notFound();
  const user = await currentUser();
  const p = row.published ?? row.draft;
  // Once a business has an owner, this link stays viewable but never offers a claim.
  const claimed = row.status === 'live' || (await ownerIds(row.id)).length > 0;
  const canEdit = !!user && (await isMember(row.id, user.id));
  const unsure = Object.keys(p.confirm).length;
  return (
    <main className="public">
      <div className="pv-banner">
        <div className="in">
          <span>
            <b>{claimed ? `${p.brand.name} · view only.` : `Private preview for ${p.brand.name}.`}</b>{' '}
            {claimed ? 'This website has been claimed by its owner.' : 'Only people with this link can see it. It isn’t on Google.'}
            {!claimed && unsure > 0 && ` ${unsure} thing${unsure === 1 ? '' : 's'} to check are marked in yellow.`}
          </span>
          <ClaimBar token={token} signedIn={!!user} claimed={claimed} canEdit={canEdit} phone={p.phone} businessId={row.id} />
        </div>
      </div>
      <Site profile={p} mode="preview" now={new Date()} />
    </main>
  );
}
