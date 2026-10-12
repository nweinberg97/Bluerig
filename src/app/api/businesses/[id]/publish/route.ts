import { revalidatePath } from 'next/cache';
import { forEditor, publish, siteUrl } from '@/lib/server/db';
import { body, fail, ok } from '@/lib/server/http';
import { publishChecks, markPhotoRights } from '@/lib/checks';
import { changedKeys, EDITABLE_KEYS, mergeFields, type ProfileKey } from '@/lib/profile';
import { adminClient } from '@/lib/supabase/server';

/**
 * Publish the draft (or only some fields, for one-tap updates from the phone).
 * If anything needs a second look, returns the list; the editor shows it and calls
 * again with the confirmed ids.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await forEditor((await params).id);
  if (!a) return fail('Not allowed.', 403);
  const b = await body<{ only: string[]; confirmed: string[] }>(req);
  const only = Array.isArray(b.only) ? (b.only.filter((k) => EDITABLE_KEYS.includes(k as ProfileKey)) as ProfileKey[]) : null;
  const confirmed = new Set(Array.isArray(b.confirmed) ? b.confirmed.map(String) : []);

  let next = only ? mergeFields(a.row.published, a.row.draft, only) : a.row.draft;
  const checks = publishChecks(next, a.row.published);
  if (checks.blocking.length) return fail(checks.blocking[0], 422, { blocking: checks.blocking });
  const open = checks.confirm.filter((c) => !confirmed.has(c.id));
  if (open.length) return fail('Please check these first.', 409, { confirm: open });

  next = markPhotoRights(next, [...confirmed]);
  const keys = changedKeys(a.row.published, next);
  const label = only ? `Quick update: ${only.join(', ')}` : keys.length ? `Updated ${keys.slice(0, 3).join(', ')}` : 'Published';
  const live = await publish(a, next, label);
  // Keep the draft's photo-rights ticks in sync so we don't ask again.
  if (confirmed.size) await adminClient().from('businesses').update({ draft: markPhotoRights(a.row.draft, [...confirmed]) }).eq('id', a.row.id);
  revalidatePath(`/s/${a.row.slug}`);
  if (a.row.custom_domain) revalidatePath(`/d/${a.row.custom_domain}`);
  return ok({ url: siteUrl(a.row), published: live });
}
