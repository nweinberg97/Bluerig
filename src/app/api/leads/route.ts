import { adminClient } from '@/lib/supabase/server';
import { body, clientIp, fail, limited, ok, str } from '@/lib/server/http';
import { sendEmail, sendSms } from '@/lib/server/notify';
import { toE164 } from '@/lib/reviews';
import type { BusinessProfile } from '@/lib/profile';

/** A customer's service request from the website form. Texted to the shop right away. */
export async function POST(req: Request) {
  const b = await body(req);
  // Bots fill the hidden field; pretend it worked.
  if (str(b.company_website, 200)) return ok();
  if (limited(`lead:${clientIp(req)}`, 5, 10 * 60 * 1000)) return fail('Too many requests. Please call instead.', 429);
  const businessId = str(b.businessId, 40);
  const name = str(b.name, 80);
  const phone = str(b.phone, 20);
  const message = str(b.message, 1000);
  const town = str(b.town, 60);
  const urgency = ['now', 'soon', 'quote'].includes(b.urgency as string) ? (b.urgency as string) : 'soon';
  if (!/^[0-9a-f-]{36}$/.test(businessId)) return fail('Unknown business.');
  if (!name || !message) return fail('Please add your name and what’s going on.');
  if (phone.replace(/\D/g, '').length < 10) return fail('Please add a phone number so they can call you back.');
  if (/https?:\/\/|<a\s/i.test(message) && message.length < 40) return ok(); // link-only spam

  const sb = adminClient();
  const { data: biz } = await sb.from('businesses').select('id, published, status').eq('id', businessId).eq('status', 'live').maybeSingle();
  if (!biz?.published) return fail('Unknown business.');
  const p = biz.published as BusinessProfile;
  const { error } = await sb.from('leads').insert({ business_id: businessId, name, phone, town, message, urgency });
  if (error) return fail('That didn’t go through. Please call instead.', 500);

  const tag = urgency === 'now' ? 'URGENT: ' : urgency === 'quote' ? 'Quote: ' : '';
  const sms = `${tag}New request from your website\n${name} · ${phone}${town ? ` · ${town}` : ''}\n“${message.slice(0, 300)}”`;
  const to = toE164(p.phone);
  await Promise.allSettled([to ? sendSms(to, sms) : Promise.resolve(), p.email ? sendEmail(p.email, `${tag}New request: ${name}`, sms) : Promise.resolve()]);
  return ok();
}
