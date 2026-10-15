import { NextResponse } from 'next/server';
import { forEditor } from '@/lib/server/db';
import { body, fail, limited, str } from '@/lib/server/http';
import { adminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/server/notify';
import { inviteEditor } from '@/lib/team/invite';

/** Owners invite people who can edit. Everyone gets the sign-in link by email. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await forEditor((await params).id);
  if (!a || (a.role !== 'owner' && a.role !== 'staff')) return fail('Only the owner can invite people.', 403);
  if (limited(`invite:${a.row.id}`, 20, 24 * 3600 * 1000)) return fail('That’s a lot of invites for one day. Try again tomorrow.', 429);
  const sb = adminClient();
  const r = await inviteEditor(
    {
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      async ensureUser(email) {
        const created = await sb.auth.admin.createUser({ email, email_confirm: true });
        if (created.data.user) return created.data.user.id;
        // Already has an account: generateLink returns the existing user.
        const link = await sb.auth.admin.generateLink({ type: 'magiclink', email });
        return link.data.user?.id ?? null;
      },
      async signInToken(email) {
        const link = await sb.auth.admin.generateLink({ type: 'magiclink', email });
        return link.data.properties?.hashed_token ?? null;
      },
      async addEditor(businessId, userId) {
        const { error } = await sb.from('members').upsert({ business_id: businessId, user_id: userId, role: 'editor' }, { onConflict: 'business_id,user_id', ignoreDuplicates: true });
        return !error;
      },
      sendEmail: (to, subject, text) => sendEmail(to, subject, text),
    },
    { businessId: a.row.id, businessName: a.row.draft.brand.name, email: str((await body(req)).email, 200), inviterEmail: a.email },
  );
  return NextResponse.json(r.body, { status: r.status });
}
