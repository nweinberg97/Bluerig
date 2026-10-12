// 1) Keeps the Supabase login fresh. 2) Serves a shop's site on its own domain.
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const APP_HOSTS = new Set(
  [process.env.NEXT_PUBLIC_APP_URL, 'http://localhost:3000']
    .filter(Boolean)
    .map((u) => new URL(u!).host),
);

export async function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const isAppHost = APP_HOSTS.has(host) || host.endsWith('.vercel.app') || host.startsWith('localhost');
  if (!isAppHost && !req.nextUrl.pathname.startsWith('/api/') && !req.nextUrl.pathname.startsWith('/_next/')) {
    const url = req.nextUrl.clone();
    url.pathname = `/d/${host.replace(/^www\./, '')}`;
    return NextResponse.rewrite(url);
  }

  let res = NextResponse.next({ request: req });
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return res;
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await sb.auth.getUser();
  return res;
}

export const config = {
  // Public site pages don't need the login refresh; skip static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webp|ico)$).*)'],
};
