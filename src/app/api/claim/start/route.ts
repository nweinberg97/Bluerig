import { byPreviewToken } from '@/lib/server/db';
import { body, fail, limited, ok, str } from '@/lib/server/http';
import { currentUser, adminClient } from '@/lib/supabase/server';
import { hashCode, newCode } from '@/lib/server/claim';
import { sendSms } from '@/lib/server/notify';
import { toE164 } from '@/lib/reviews';

/** Send a 6-digit code to the phone number listed for the business (text or call). */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return fail('Sign in first.', 401);
  const b = await body(req);
  const row = await byPreviewToken(str(b.token, 40));
  if (!row) return fail('This preview link has expired.', 404);
  if (row.status === 'live') return fail('This business has already been claimed.');
  const p = row.published ?? row.draft;
  const to = toE164(p.phone);
  if (!to) return fail('There’s no phone number on this site to send a code to. Contact Bluerig and we’ll verify you another way.');
  if (limited(`claim:${row.id}`, 4, 60 * 60 * 1000)) return fail('Too many codes sent. Try again in an hour.', 429);

  const code = newCode();
  await adminClient().from('claims').upsert({ business_id: row.id, code_hash: hashCode(row.id, code), expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), attempts: 0, sent_to: to });
  if (b.channel === 'call') {
    const r = await callWithCode(to, code);
    if (!r) return fail('We couldn’t place the call. Try a text instead.', 502);
  } else {
    const r = await sendSms(to, `Your Bluerig code for ${p.brand.name} is ${code}. It expires in 15 minutes. If you didn’t ask for this, ignore it.`);
    if (!r.ok) return fail('We couldn’t text that number. If it’s a landline, choose “Call me instead”.', 502);
  }
  return ok();
}

async function callWithCode(to: string, code: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM_NUMBER;
  const spoken = code.split('').join(', ');
  if (!sid || !token || !from) {
    console.log(`[call → ${to}] code ${code}`);
    return true;
  }
  const twiml = `<Response><Pause length="1"/><Say voice="Polly.Joanna">Hello. Your Bluerig code is ${spoken}. Again, ${spoken}. Goodbye.</Say></Response>`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Twiml: twiml }),
  });
  return res.ok;
}
