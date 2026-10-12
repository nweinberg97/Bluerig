// Reviews: asking for them (a text with the shop's Google review link) and showing
// them (Google's own rating and reviews via the Places API, with attribution).
// We never copy reviews into the site by hand, and we never filter who gets asked.

import type { BusinessProfile } from './profile';
import { digits } from './profile';

/** Google's documented "write a review" link for a place. */
export function reviewLink(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/**
 * The text a homeowner gets after a job. Canada's anti-spam law (CASL) wants the sender
 * identified and a way to opt out in every commercial message, so both are always here.
 */
export function reviewRequestText(p: BusinessProfile, opts: { firstName?: string; link: string }): string {
  const hi = opts.firstName?.trim() ? `Hi ${opts.firstName.trim().split(' ')[0]}, ` : 'Hi, ';
  const contact = p.phone ? ` ${p.phone}` : '';
  return `${hi}thanks for choosing ${p.brand.name}. If you have a minute, a Google review helps a lot: ${opts.link}\n— ${p.brand.name}${contact}. Reply STOP to opt out.`;
}

/** Normalise a Canadian mobile number to E.164, or null. */
export function toE164(input: string): string | null {
  const d = digits(input);
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

export interface GoogleReview {
  author: string;
  authorUrl?: string;
  photoUrl?: string;
  rating: number;
  text: string;
  when: string; // "2 weeks ago", as Google writes it
}
export interface GoogleReviews {
  rating: number | null;
  count: number;
  mapsUrl: string | null;
  reviews: GoogleReview[];
}

/**
 * Up to 5 reviews as Google chooses them, plus the overall rating. Cached by the page's
 * revalidate window, never stored in our database. Returns null when not configured.
 */
export async function fetchGoogleReviews(placeId: string, apiKey: string | undefined, fetcher: typeof fetch = fetch): Promise<GoogleReviews | null> {
  if (!apiKey || !placeId) return null;
  const res = await fetcher(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'rating,userRatingCount,reviews,googleMapsUri' },
    next: { revalidate: 60 * 60 * 12 },
  } as RequestInit);
  if (!res.ok) return null;
  const j = (await res.json()) as {
    rating?: number;
    userRatingCount?: number;
    googleMapsUri?: string;
    reviews?: { rating?: number; text?: { text?: string }; relativePublishTimeDescription?: string; authorAttribution?: { displayName?: string; uri?: string; photoUri?: string } }[];
  };
  return {
    rating: typeof j.rating === 'number' ? j.rating : null,
    count: j.userRatingCount ?? 0,
    mapsUrl: j.googleMapsUri ?? null,
    reviews: (j.reviews ?? [])
      .filter((r) => r.text?.text)
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? 'Google user',
        authorUrl: r.authorAttribution?.uri,
        photoUrl: r.authorAttribution?.photoUri,
        rating: r.rating ?? 5,
        text: r.text!.text!,
        when: r.relativePublishTimeDescription ?? '',
      })),
  };
}
