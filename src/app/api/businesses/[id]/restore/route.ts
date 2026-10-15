import { revalidatePath } from 'next/cache';
import { forEditor, publish } from '@/lib/server/db';
import { body, fail, ok } from '@/lib/server/http';
import { adminClient } from '@/lib/supabase/server';
import type { BusinessProfile } from '@/lib/profile';

/** Put an earlier version back live (and into the draft). This is undo. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await forEditor((await params).id);
  if (!a) return fail('Not allowed.', 403);
  const versionId = Number((await body(req)).versionId);
  const sb = adminClient();
  const { data: v } = await sb.from('site_versions').select('profile, created_at').eq('id', versionId).eq('business_id', a.row.id).maybeSingle();
  if (!v) return fail('That version isn’t there anymore.', 404);
  const profile = v.profile as BusinessProfile;
  const live = await publish(a, profile, `Restored version from ${new Date(v.created_at).toLocaleString('en-CA')}`);
  await sb.from('businesses').update({ draft: live }).eq('id', a.row.id);
  revalidatePath(`/s/${a.row.slug}`);
  if (a.row.custom_domain) revalidatePath(`/d/${a.row.custom_domain}`);
  return ok({ published: live });
}
