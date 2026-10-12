// Data access. Every function that takes a user checks membership before using the
// service-role client, so pages and API routes can't forget to.
import 'server-only';
import type { BusinessProfile } from '../profile';
import { pruneExpired } from '../time';
import { adminClient, currentUser, isStaff } from '../supabase/server';

export interface BusinessRow {
  id: string;
  slug: string;
  status: 'preview' | 'live' | 'archived';
  draft: BusinessProfile;
  published: BusinessProfile | null;
  published_at: string | null;
  preview_token: string;
  custom_domain: string | null;
  source_url: string | null;
  import_sources: unknown;
  updated_at: string;
  created_at: string;
}

const COLS = 'id, slug, status, draft, published, published_at, preview_token, custom_domain, source_url, import_sources, updated_at, created_at';

export async function liveBySlug(slug: string): Promise<BusinessRow | null> {
  const { data } = await adminClient().from('businesses').select(COLS).eq('slug', slug).eq('status', 'live').maybeSingle();
  return (data as BusinessRow | null) ?? null;
}

export async function liveByDomain(host: string): Promise<BusinessRow | null> {
  const { data } = await adminClient().from('businesses').select(COLS).eq('custom_domain', host.toLowerCase()).eq('status', 'live').maybeSingle();
  return (data as BusinessRow | null) ?? null;
}

export async function byPreviewToken(token: string): Promise<BusinessRow | null> {
  if (!/^[a-f0-9]{36}$/.test(token)) return null;
  const { data } = await adminClient().from('businesses').select(COLS).eq('preview_token', token).neq('status', 'archived').maybeSingle();
  return (data as BusinessRow | null) ?? null;
}

export type Access = { row: BusinessRow; userId: string; email: string | null; role: 'owner' | 'editor' | 'staff' };

/** The business, if the signed-in user is a member (or Bluerig staff). */
export async function forEditor(id: string): Promise<Access | null> {
  const user = await currentUser();
  if (!user || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const sb = adminClient();
  const [{ data: row }, { data: m }] = await Promise.all([
    sb.from('businesses').select(COLS).eq('id', id).maybeSingle(),
    sb.from('members').select('role').eq('business_id', id).eq('user_id', user.id).maybeSingle(),
  ]);
  if (!row) return null;
  const role = (m?.role as 'owner' | 'editor' | undefined) ?? (isStaff(user.email) ? 'staff' : undefined);
  return role ? { row: row as BusinessRow, userId: user.id, email: user.email ?? null, role } : null;
}

export async function myBusinesses(): Promise<{ id: string; slug: string; name: string; status: string; role: string }[]> {
  const user = await currentUser();
  if (!user) return [];
  const { data } = await adminClient().from('members').select('role, businesses(id, slug, status, draft)').eq('user_id', user.id);
  return (data ?? []).flatMap((m: { role: string; businesses: unknown }) => {
    const b = (Array.isArray(m.businesses) ? m.businesses[0] : m.businesses) as { id: string; slug: string; status: string; draft: BusinessProfile } | null;
    return b ? [{ id: b.id, slug: b.slug, name: b.draft.brand.name, status: b.status, role: m.role }] : [];
  });
}

/** Snapshot the draft as the live site and keep a version for undo. */
export async function publish(a: Access, profile: BusinessProfile, label = 'Published') {
  const sb = adminClient();
  const now = new Date();
  const clean = pruneExpired(profile, now);
  const { error } = await sb
    .from('businesses')
    .update({ published: clean, draft: clean, published_at: now.toISOString(), ...(a.row.status === 'preview' ? {} : {}) })
    .eq('id', a.row.id);
  if (error) throw error;
  await sb.from('site_versions').insert({ business_id: a.row.id, profile: clean, label, created_by: a.userId });
  return clean;
}

export async function versions(id: string) {
  const { data } = await adminClient().from('site_versions').select('id, label, created_at').eq('business_id', id).order('created_at', { ascending: false }).limit(30);
  return data ?? [];
}

export async function uniqueSlug(base: string): Promise<string> {
  const sb = adminClient();
  for (let i = 0; i < 20; i++) {
    const s = i ? `${base.slice(0, 44)}-${i + 1}` : base;
    const { data } = await sb.from('businesses').select('id').eq('slug', s).maybeSingle();
    if (!data) return s;
  }
  return `${base.slice(0, 38)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function siteUrl(row: Pick<BusinessRow, 'slug' | 'custom_domain'>): string {
  if (row.custom_domain) return `https://${row.custom_domain}`;
  const app = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${app.replace(/\/$/, '')}/s/${row.slug}`;
}
