import { body, fail, str } from '@/lib/server/http';
import { currentUser } from '@/lib/supabase/server';
import { startClaim } from '@/lib/claim/flow';
import { claimDeps } from '@/lib/server/claim-deps';
import { NextResponse } from 'next/server';

/** Send a 6-digit code to the phone number listed for the business (text or call). */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return fail('Sign in first.', 401);
  const b = await body(req);
  const r = await startClaim(claimDeps(), { userId: user.id, token: str(b.token, 40), channel: str(b.channel, 10) });
  return NextResponse.json(r.body, { status: r.status });
}
