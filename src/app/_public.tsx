// Shared by the live site routes (/s/slug and custom domains).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Site } from '@/components/Site';
import type { BusinessRow } from '@/lib/server/db';
import { siteUrl } from '@/lib/server/db';
import { jsonLd, metaDescription, pageTitle } from '@/lib/seo';
import { fetchGoogleReviews, reviewLink } from '@/lib/reviews';
import { pruneExpired } from '@/lib/time';

export function liveMetadata(row: BusinessRow | null): Metadata {
  if (!row?.published) return { title: 'Not found' };
  const p = row.published;
  return {
    title: pageTitle(p),
    description: metaDescription(p),
    alternates: { canonical: siteUrl(row) },
    openGraph: { title: pageTitle(p), description: metaDescription(p), url: siteUrl(row), images: p.brand.logoUrl ? [p.brand.logoUrl] : undefined, locale: 'en_CA', type: 'website' },
    icons: p.brand.logoUrl ? { icon: p.brand.logoUrl } : undefined,
  };
}

export async function LivePage({ row }: { row: BusinessRow | null }) {
  if (!row?.published) notFound();
  const now = new Date();
  // Time rules apply on every render, so deals and emergency bars switch off on time
  // even if nobody publishes again.
  const p = pruneExpired(row.published, now);
  const reviews = p.googlePlaceId ? await fetchGoogleReviews(p.googlePlaceId, process.env.GOOGLE_PLACES_API_KEY).catch(() => null) : null;
  const ld = jsonLd(p, siteUrl(row), now);
  return (
    <main className="public">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <Site profile={p} mode="live" now={now} businessId={row.id} reviews={reviews} reviewLink={p.googlePlaceId ? reviewLink(p.googlePlaceId) : null} />
    </main>
  );
}
