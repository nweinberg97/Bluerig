import { forEditor } from '@/lib/server/db';
import { body, fail, limited, ok, str } from '@/lib/server/http';
import { sendSms } from '@/lib/server/notify';
import { reviewLink, reviewRequestText, toE164 } from '@/lib/reviews';
import { adminClient } from '@/lib/supabase/server';

/**
 * Text a homeowner the shop's Google review link after a job. Everyone gets the same
 * link (Google doesn't allow only asking happy customers), anyone who replied STOP is
 * skipped, and the same number isn't asked twice in 30 days.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await forEditor((await params).id);
  if (!a) return fail('Not allowed.', 403);
  const p = a.row.published ?? a.row.draft;
  if (!p.googlePlaceId && !p.reviewsUrl) return fail('Connect your Google listing first, so we know where to send people.');
  const b = await body(req);
  const phone = toE164(str(b.phone, 20));
  if (!phone) return fail('That doesn’t look like a mobile number.');
  if (!str(b.consent, 5)) return fail('Tick the box to confirm you just did work for this customer.');
  if (limited(`rr:${a.row.id}`, 40, 24 * 3600 * 1000)) return fail('That’s a lot of requests for one day. Try again tomorrow.', 429);

  const sb = adminClient();
  const [{ data: out }, { data: recent }] = await Promise.all([
    sb.from('sms_opt_outs').select('phone_e164').eq('phone_e164', phone).maybeSingle(),
    sb.from('review_requests').select('id').eq('business_id', a.row.id).eq('phone_e164', phone).gte('created_at', new Date(Date.now() - 30 * 86400e3).toISOString()).limit(1),
  ]);
  if (out) {
    await sb.from('review_requests').insert({ business_id: a.row.id, phone_e164: phone, first_name: str(b.firstName, 40) || null, sent_by: a.userId, status: 'blocked' });
    return fail('This person has asked not to get texts, so we didn’t send it.');
  }
  if (recent?.length) return fail('You already asked this customer in the last 30 days.');

  const link = p.googlePlaceId ? reviewLink(p.googlePlaceId) : p.reviewsUrl!;
  const text = reviewRequestText(p, { firstName: str(b.firstName, 40), link });
  const r = await sendSms(phone, text);
  await sb.from('review_requests').insert({ business_id: a.row.id, phone_e164: phone, first_name: str(b.firstName, 40) || null, sent_by: a.userId, status: r.ok ? 'sent' : 'failed' });
  if (!r.ok) return fail('The text didn’t go through. Check the number and try again.', 502);
  return ok({ preview: text });
}
