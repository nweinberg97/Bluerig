import { createHmac, timingSafeEqual } from 'node:crypto';
import { adminClient } from '@/lib/supabase/server';

/**
 * Twilio calls this when someone texts back. STOP (and the usual variants) records an
 * opt-out so no shop on Bluerig texts that number again. Twilio's own opt-out handling
 * still applies on top of this.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const token = process.env.TWILIO_AUTH_TOKEN;
  const url = process.env.TWILIO_WEBHOOK_URL;
  if (token && url) {
    const sorted = [...params.keys()].sort().map((k) => k + params.get(k)).join('');
    const expected = createHmac('sha1', token).update(url + sorted).digest('base64');
    const got = req.headers.get('x-twilio-signature') ?? '';
    const ok = got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
    if (!ok) return new Response('Forbidden', { status: 403 });
  }
  const from = params.get('From') ?? '';
  const text = (params.get('Body') ?? '').trim().toUpperCase();
  const sb = adminClient();
  if (/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT|ARRET|ARRÊT)\b/.test(text) && from) {
    await sb.from('sms_opt_outs').upsert({ phone_e164: from });
  } else if (/^(START|UNSTOP|YES)\b/.test(text) && from) {
    await sb.from('sms_opt_outs').delete().eq('phone_e164', from);
  }
  return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
}
