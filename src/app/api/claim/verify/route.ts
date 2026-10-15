import { body, fail, str } from '@/lib/server/http';
import { currentUser } from '@/lib/supabase/server';
import { verifyClaim } from '@/lib/claim/flow';
import { claimDeps } from '@/lib/server/claim-deps';
import { NextResponse } from 'next/server';

/** Check the code; on success the signed-in person becomes the owner. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return fail('Sign in first.', 401);
  const b = await body(req);
  const r = await verifyClaim(claimDeps(), { userId: user.id, token: str(b.token, 40), code: str(b.code, 6) });
  return NextResponse.json(r.body, { status: r.status });
}
