import { forEditor } from '@/lib/server/db';
import { body, fail, limited, ok } from '@/lib/server/http';
import { adminClient } from '@/lib/supabase/server';
import { EDITABLE_KEYS, type ProfileKey } from '@/lib/profile';

/**
 * Save one field of the draft: { path: ['copy','intro'], value: '...' }.
 * Per-field writes are what let two people edit at once without clobbering each other.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await forEditor((await params).id);
  if (!a) return fail('Not allowed.', 403);
  if (limited(`draft:${a.userId}`, 240, 60 * 1000)) return fail('Saving too fast.', 429);
  const b = await body<{ path: unknown[]; value: unknown }>(req);
  const path = Array.isArray(b.path) ? b.path.map(String) : [];
  if (!path.length || path.length > 6 || !EDITABLE_KEYS.includes(path[0] as ProfileKey)) return fail('Can’t change that.');
  if (!('value' in b)) return fail('Nothing to save.');
  const { data, error } = await adminClient().rpc('apply_draft_patch', { b: a.row.id, path, value: b.value as never });
  if (error) return fail('Couldn’t save. Check your connection.', 500);
  return ok({ updatedAt: data });
}
