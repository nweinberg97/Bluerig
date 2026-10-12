import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { forEditor, siteUrl } from '@/lib/server/db';
import { currentUser } from '@/lib/supabase/server';
import { PromoteClient } from '@/components/editor/PromoteClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Promote · Bluerig', robots: { index: false } };

export default async function Promote({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await currentUser())) redirect(`/login?next=/edit/${id}/promote`);
  const a = await forEditor(id);
  if (!a) notFound();
  return <PromoteClient id={a.row.id} profile={a.row.published ?? a.row.draft} siteUrl={siteUrl(a.row)} live={a.row.status === 'live'} />;
}
