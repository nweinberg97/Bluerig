import { forEditor, siteUrl } from '@/lib/server/db';
import { fail } from '@/lib/server/http';
import { FORMATS, renderPromo } from '@/lib/promo';
import { slugify } from '@/lib/profile';

async function inline(url: string): Promise<string | null> {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    const r = await fetch(u, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const type = r.headers.get('content-type') ?? '';
    if (!/^image\//.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.byteLength > 5_000_000) return null;
    return `data:${type.split(';')[0]};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Download one design as an SVG file with the logo and photos built in. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await forEditor((await params).id);
  if (!a) return fail('Not allowed.', 403);
  const q = new URL(req.url).searchParams;
  const format = q.get('format') ?? 'post';
  if (!FORMATS.some((f) => f.id === format)) return fail('Unknown design.');
  const p = structuredClone(a.row.published ?? a.row.draft);
  if (p.brand.logoUrl) p.brand.logoUrl = (await inline(p.brand.logoUrl)) ?? p.brand.logoUrl;
  for (const s of p.services) if (s.photoUrl) s.photoUrl = (await inline(s.photoUrl)) ?? s.photoUrl;
  for (const j of p.jobs) if (j.photoUrl) j.photoUrl = (await inline(j.photoUrl)) ?? j.photoUrl;
  let content: Record<string, string> | undefined;
  try {
    content = q.get('content') ? JSON.parse(q.get('content')!) : undefined;
  } catch {
    content = undefined;
  }
  const svg = renderPromo(p, format, {
    topic: q.get('topic') ?? 'brand',
    variant: Number(q.get('v') ?? 0) % 3,
    slide: Number(q.get('slide') ?? 0),
    side: q.get('side') === '1' ? 1 : 0,
    print: q.get('print') === '1',
    siteUrl: siteUrl(a.row),
    content,
  });
  const name = `${slugify(p.brand.name)}-${format}${q.get('slide') ? `-${Number(q.get('slide')) + 1}` : ''}${q.get('side') === '1' ? '-back' : ''}.svg`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'private, no-store' } });
}
