// Texts, calls and email with plain fetch calls.
// Development: when a provider isn't configured, messages go to the server log.
// Production: an unconfigured provider is a failure, never a pretend "sent".

type Env = Record<string, string | undefined>;
const isProd = (env: Env) => env.NODE_ENV === 'production';

export const smsConfigured = (env: Env = process.env) => !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_NUMBER);
export const emailConfigured = (env: Env = process.env) => !!env.RESEND_API_KEY;

export interface SendResult {
  ok: boolean;
  logged?: boolean;
  error?: string;
}

const twilioAuth = (env: Env) => 'Basic ' + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');

export async function sendSms(to: string, body: string, env: Env = process.env, fetcher: typeof fetch = fetch): Promise<SendResult> {
  if (!smsConfigured(env)) {
    if (isProd(env)) return { ok: false, error: 'Text messages aren’t set up on this server.' };
    console.log(`[sms → ${to}] ${body}`);
    return { ok: true, logged: true };
  }
  const res = await fetcher(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: twilioAuth(env), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER!, Body: body }),
  });
  return res.ok ? { ok: true } : { ok: false, error: `SMS failed (${res.status})` };
}

/** A voice call that reads out a 6-digit code (for landlines). */
export async function callWithCode(to: string, code: string, env: Env = process.env, fetcher: typeof fetch = fetch): Promise<SendResult> {
  if (!smsConfigured(env)) {
    if (isProd(env)) return { ok: false, error: 'Phone calls aren’t set up on this server.' };
    console.log(`[call → ${to}] code ${code}`);
    return { ok: true, logged: true };
  }
  const spoken = code.split('').join(', ');
  const twiml = `<Response><Pause length="1"/><Say voice="Polly.Joanna">Hello. Your Bluerig code is ${spoken}. Again, ${spoken}. Goodbye.</Say></Response>`;
  const res = await fetcher(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`, {
    method: 'POST',
    headers: { Authorization: twilioAuth(env), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: env.TWILIO_FROM_NUMBER!, Twiml: twiml }),
  });
  return res.ok ? { ok: true } : { ok: false, error: `Call failed (${res.status})` };
}

export async function sendEmail(to: string, subject: string, text: string, env: Env = process.env, fetcher: typeof fetch = fetch): Promise<SendResult> {
  if (!emailConfigured(env)) {
    if (isProd(env)) return { ok: false, error: 'Email isn’t set up on this server.' };
    console.log(`[email → ${to}] ${subject}\n${text}`);
    return { ok: true, logged: true };
  }
  const res = await fetcher('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM || 'Bluerig <hello@example.com>', to, subject, text }),
  });
  return res.ok ? { ok: true } : { ok: false, error: `Email failed (${res.status})` };
}
