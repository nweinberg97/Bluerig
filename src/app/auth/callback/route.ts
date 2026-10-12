import { NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase/server';

/** Magic links land here. Only same-site paths are allowed as the next page. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/dashboard';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard';
  if (code) {
    const sb = await userClient();
    await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
