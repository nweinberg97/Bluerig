import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { forEditor, siteUrl } from '@/lib/server/db';
import { currentUser } from '@/lib/supabase/server';
import { EditorClient } from '@/components/editor/EditorClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit your website · Bluerig', robots: { index: false } };

export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await currentUser())) redirect(`/login?next=/edit/${id}`);
  const a = await forEditor(id);
  if (!a) notFound();
  return (
    <EditorClient
      id={a.row.id}
      slug={a.row.slug}
      siteUrl={siteUrl(a.row)}
      previewUrl={`/p/${a.row.preview_token}`}
      live={a.row.status === 'live'}
      role={a.role}
      me={{ id: a.userId, email: a.email }}
      draft={a.row.draft}
      published={a.row.published}
    />
  );
}
