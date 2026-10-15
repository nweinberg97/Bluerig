import { NextResponse } from 'next/server';
import { userClient } from '@/lib/supabase/server';

/** Sign-in links land here (?code=… or ?token_hash=…). Only same-site paths are allowed as the next page. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/dashboard';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard';
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const sb = await userClient();
  if (code) {
    await sb.auth.exchangeCodeForSession(code);
  } else if (tokenHash && (type === 'magiclink' || type === 'email' || type === 'invite' || type === 'signup')) {
    // Email-template style links (token_hash) work across devices, unlike code links.
    await sb.auth.verifyOtp({ type, token_hash: tokenHash });
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
