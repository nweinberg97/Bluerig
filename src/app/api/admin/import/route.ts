import { adminClient, currentUser, isStaff } from '@/lib/supabase/server';
import { body, fail, ok, str } from '@/lib/server/http';
import { importFromUrl } from '@/lib/server/import';
import { ImportError } from '@/lib/import/fetch-site';
import { uniqueSlug } from '@/lib/server/db';
import { slugify } from '@/lib/profile';

export const maxDuration = 60;

/** Bluerig staff: paste a shop's website, get a private preview link back. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !isStaff(user.email)) return fail('Not allowed.', 403);
  const url = str((await body(req)).url, 300);
  if (!url) return fail('Paste a website address.');
  try {
    const r = await importFromUrl(url);
    const slug = await uniqueSlug(slugify(r.profile.brand.name === 'Your Shop' ? new URL(r.root).hostname.replace(/^www\.|\.[a-z.]+$/g, '') : r.profile.brand.name));
    const { data, error } = await adminClient()
      .from('businesses')
      .insert({ slug, status: 'preview', draft: r.profile, source_url: r.root, import_sources: { sources: r.sources, warnings: r.warnings, skipped: r.skipped }, created_by: user.id })
      .select('id, preview_token')
      .single();
    if (error) return fail('Couldn’t save the draft.', 500);
    return ok({ id: data.id, previewToken: data.preview_token, warnings: r.warnings });
  } catch (e) {
    if (e instanceof ImportError) return fail(e.message, 422);
    console.error(e);
    return fail('Something went wrong reading that site.', 500);
  }
}
