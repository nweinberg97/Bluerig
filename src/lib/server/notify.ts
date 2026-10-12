// Text messages and email with plain fetch calls. When a provider isn't configured,
// messages are written to the server log so development works with no accounts.
import 'server-only';

export async function sendSms(to: string, body: string): Promise<{ ok: boolean; logged?: boolean; error?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    console.log(`[sms → ${to}] ${body}`);
    return { ok: true, logged: true };
  }
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  if (!res.ok) return { ok: false, error: `SMS failed (${res.status})` };
  return { ok: true };
}

export async function sendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean; logged?: boolean }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email → ${to}] ${subject}\n${text}`);
    return { ok: true, logged: true };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Bluerig <hello@example.com>', to, subject, text }),
  });
  return { ok: res.ok };
}
