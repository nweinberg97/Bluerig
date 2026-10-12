import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { forEditor, siteUrl } from '@/lib/server/db';
import { currentUser } from '@/lib/supabase/server';
import { QuickActions } from '@/components/editor/QuickActions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Quick updates · Bluerig', robots: { index: false } };

export default async function Quick({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await currentUser())) redirect(`/login?next=/edit/${id}/quick`);
  const a = await forEditor(id);
  if (!a) notFound();
  return <QuickActions id={a.row.id} siteUrl={siteUrl(a.row)} live={a.row.status === 'live'} me={{ id: a.userId, email: a.email }} draft={a.row.draft} published={a.row.published} />;
}
