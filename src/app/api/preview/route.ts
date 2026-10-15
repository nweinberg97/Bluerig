import { NextResponse } from 'next/server';
import { body, clientIp, limited, str } from '@/lib/server/http';
import { adminClient } from '@/lib/supabase/server';
import { sendEmail, sendSms } from '@/lib/server/notify';
import { importFromUrl } from '@/lib/server/import';
import { ImportError } from '@/lib/import/fetch-site';
import { ownerIds, uniqueSlug } from '@/lib/server/db';
import { slugify } from '@/lib/profile';
import { requestPreview } from '@/lib/preview/request';

export const maxDuration = 60;

/** Landing page: "type your website" → a private preview of the new one. */
export async function POST(req: Request) {
  const b = await body(req);
  const sb = adminClient();
  const r = await requestPreview(
    {
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      async findByHost(host) {
        const { data } = await sb.from('businesses').select('id, status, preview_token').eq('import_sources->>host', host).neq('status', 'archived').limit(1).maybeSingle();
        if (!data) return null;
        const claimed = data.status === 'live' || (await ownerIds(data.id)).length > 0;
        return { id: data.id, token: data.preview_token, claimed };
      },
      async build(url, host, requestedBy) {
        const r = await importFromUrl(url).catch((e) => {
          // Only show our own plain messages (like "this site asks robots not to read it").
          throw new Error(e instanceof ImportError ? e.message : 'We couldn’t read that website. Check the address and try again.');
        });
        const slug = await uniqueSlug(slugify(r.profile.brand.name === 'Your Shop' ? host.split('.')[0] : r.profile.brand.name));
        const { data, error } = await sb
          .from('businesses')
          .insert({ slug, status: 'preview', draft: r.profile, source_url: r.root, import_sources: { host, requestedBy, sources: r.sources, warnings: r.warnings, skipped: r.skipped } })
          .select('id, preview_token')
          .single();
        if (error || !data) throw new Error('We couldn’t save your preview. Please try again.');
        return { id: data.id, token: data.preview_token, claimed: false, profile: r.profile };
      },
      sendSms: (to, text) => sendSms(to, text),
      sendEmail: (to, subject, text) => sendEmail(to, subject, text),
      limited,
    },
    { website: str(b.website, 300), contact: str(b.contact, 120), ip: clientIp(req) },
  );
  return NextResponse.json(r.body, { status: r.status });
}
