import { byPreviewToken } from '@/lib/server/db';
import { body, fail, ok, str } from '@/lib/server/http';
import { currentUser, adminClient } from '@/lib/supabase/server';
import { codeMatches } from '@/lib/server/claim';

/** Check the code; on success the signed-in person becomes the owner. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return fail('Sign in first.', 401);
  const b = await body(req);
  const row = await byPreviewToken(str(b.token, 40));
  if (!row) return fail('This preview link has expired.', 404);
  const code = str(b.code, 6);
  const sb = adminClient();
  const { data: c } = await sb.from('claims').select('code_hash, expires_at, attempts').eq('business_id', row.id).maybeSingle();
  if (!c) return fail('Ask for a code first.');
  if (new Date(c.expires_at).getTime() < Date.now()) return fail('That code expired. Ask for a new one.');
  if (c.attempts >= 5) return fail('Too many tries. Ask for a new code.');
  if (!/^\d{6}$/.test(code) || !codeMatches(row.id, code, c.code_hash)) {
    await sb.from('claims').update({ attempts: c.attempts + 1 }).eq('business_id', row.id);
    return fail('That code didn’t match.');
  }
  await sb.from('members').upsert({ business_id: row.id, user_id: user.id, role: 'owner' }, { onConflict: 'business_id,user_id' });
  await sb.from('claims').delete().eq('business_id', row.id);
  return ok({ businessId: row.id });
}
