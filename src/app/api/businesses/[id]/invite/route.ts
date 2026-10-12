import { forEditor } from '@/lib/server/db';
import { body, fail, ok, str } from '@/lib/server/http';
import { adminClient } from '@/lib/supabase/server';

/** Owners invite people who can edit. They get a sign-in link by email. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await forEditor((await params).id);
  if (!a || (a.role !== 'owner' && a.role !== 'staff')) return fail('Only the owner can invite people.', 403);
  const email = str((await body(req)).email, 200).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) return fail('That email doesn’t look right.');
  const sb = adminClient();
  const app = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const redirectTo = `${app}/auth/callback?next=/edit/${a.row.id}`;
  // Existing users get a magic link; new people get an invite. Either way: membership.
  let userId: string | undefined;
  const inv = await sb.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (inv.data.user) userId = inv.data.user.id;
  else {
    const link = await sb.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } });
    userId = link.data.user?.id;
    if (!userId) return fail('Couldn’t invite that person. Try again.', 500);
    // generateLink doesn't send email: sign-in from /login works for them now.
  }
  const { error } = await sb.from('members').upsert({ business_id: a.row.id, user_id: userId, role: 'editor' }, { onConflict: 'business_id,user_id', ignoreDuplicates: true });
  if (error) return fail('Couldn’t add them. Try again.', 500);
  return ok({ email });
}
