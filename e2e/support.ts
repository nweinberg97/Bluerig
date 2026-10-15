// Helpers for the journey test: a mock for Twilio/Resend plus a fake shop website,
// starting and stopping the real app server, and sign-in links.
import { createServer, type Server } from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

export const APP = 'http://localhost:3100';
export const MOCK_PORT = 4010;
export const MOCK = `http://127.0.0.1:${MOCK_PORT}`;
export const ADMIN_EMAIL = 'admin@e2e.test';
export const OWNER_EMAIL = 'owner@e2e.test';

export const SUPABASE_URL = need('SUPABASE_URL');
const ANON_KEY = need('SUPABASE_ANON_KEY');
const SERVICE_KEY = need('SUPABASE_SERVICE_ROLE_KEY');

function need(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set. Run \`supabase start\` and export its URL and keys (see e2e/README.md).`);
  return v;
}

export const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ---------- mock Twilio, Resend and a shop's old website ----------

export interface Sent {
  kind: 'sms' | 'call' | 'email';
  to: string;
  body: string;
}

const HOME = `<!doctype html><html><head>
<title>Northline Mechanical | Heating &amp; Cooling in Port Coquitlam</title>
<meta name="theme-color" content="#1f6f8b">
<style>.btn{background:#1f6f8b;color:#fff}.accent{color:#f2a03d}.x{color:#1f6f8b}</style>
</head><body>
<header><img src="/logo.png" alt="Northline Mechanical logo" class="logo"><a href="/shop/contact">Contact us</a></header>
<h1>Furnace repair and installation</h1>
<h2>Heat Pumps</h2>
<h2>Hot Water Tanks</h2>
<p>We install high-efficiency furnaces that keep Tri-Cities homes warm all winter.</p>
<p>Heat pumps keep you cool in summer and warm in winter. Hot water tank replacement for homes in Port Coquitlam, Coquitlam and Port Moody.</p>
<p>Call <a href="tel:+16045550142">604-555-0142</a></p>
</body></html>`;

const CONTACT = `<!doctype html><html><head><title>Contact | Northline Mechanical</title></head><body>
<h1>Contact</h1>
<p>Northline Mechanical, 1234 Example Ave, Port Coquitlam, BC V3B 0A1</p>
<p>Hours: Mon-Fri 8am-5pm, Sat closed, Sun closed</p>
<p><a href="mailto:office@northline.example">office@northline.example</a></p>
</body></html>`;

export function startMock(): Promise<{ sent: Sent[]; stop: () => Promise<void> }> {
  const sent: Sent[] = [];
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = req.url ?? '/';
      if (req.method === 'GET' && (url === '/shop/' || url === '/shop')) return html(res, HOME);
      if (req.method === 'GET' && url === '/shop/contact') return html(res, CONTACT);
      if (req.method === 'POST' && /\/twilio\/2010-04-01\/Accounts\/[^/]+\/Messages\.json$/.test(url)) {
        const f = new URLSearchParams(raw);
        sent.push({ kind: 'sms', to: f.get('To') ?? '', body: f.get('Body') ?? '' });
        return json(res, 201, { sid: `SM${sent.length}` });
      }
      if (req.method === 'POST' && /\/twilio\/2010-04-01\/Accounts\/[^/]+\/Calls\.json$/.test(url)) {
        const f = new URLSearchParams(raw);
        sent.push({ kind: 'call', to: f.get('To') ?? '', body: f.get('Twiml') ?? '' });
        return json(res, 201, { sid: `CA${sent.length}` });
      }
      if (req.method === 'POST' && url === '/resend/emails') {
        const j = JSON.parse(raw || '{}');
        sent.push({ kind: 'email', to: String(j.to), body: `${j.subject}\n${j.text}` });
        return json(res, 200, { id: `em${sent.length}` });
      }
      res.writeHead(404).end();
    });
  });
  return new Promise((resolve) =>
    server.listen(MOCK_PORT, () => resolve({ sent, stop: () => new Promise((r) => server.close(() => r())) })),
  );
}
const html = (res: import('node:http').ServerResponse, body: string) => res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(body);
const json = (res: import('node:http').ServerResponse, status: number, body: unknown) => res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));

// ---------- the real app server (next start) ----------

export const appEnv: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'production',
  PORT: '3100',
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  NEXT_PUBLIC_APP_URL: APP,
  ADMIN_EMAILS: ADMIN_EMAIL,
  CLAIM_SECRET: 'e2e-claim-secret-not-for-real-use',
  BLUERIG_E2E: '1',
  TWILIO_ACCOUNT_SID: 'ACe2e',
  TWILIO_AUTH_TOKEN: 'e2e',
  TWILIO_FROM_NUMBER: '+16045550100',
  TWILIO_API_BASE: `${MOCK}/twilio`,
  RESEND_API_KEY: 're_e2e',
  RESEND_API_BASE: `${MOCK}/resend`,
  EMAIL_FROM: 'Bluerig <test@e2e.test>',
  LLM_BASE_URL: '',
  GOOGLE_PLACES_API_KEY: '',
};

export async function startApp(): Promise<ChildProcess> {
  const child = spawn('node_modules/.bin/next', ['start', '-p', '3100'], { env: appEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', (d) => process.stdout.write(`[app] ${d}`));
  child.stderr?.on('data', (d) => process.stderr.write(`[app] ${d}`));
  const until = Date.now() + 60_000;
  while (Date.now() < until) {
    if (child.exitCode !== null) throw new Error(`The app exited early (code ${child.exitCode}).`);
    try {
      const r = await fetch(APP, { redirect: 'manual' });
      if (r.status < 500) return child;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  child.kill('SIGKILL');
  throw new Error('The app did not start within 60 seconds.');
}

export async function stopApp(child: ChildProcess) {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 10_000);
  });
}

// ---------- people ----------

export async function ensureUser(email: string) {
  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  const found = data.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data: created, error } = await db.auth.admin.createUser({ email, email_confirm: true });
  if (error || !created.user) throw error ?? new Error('could not create user');
  return created.user.id;
}

/** A one-time sign-in link, the same kind the email would contain. */
export async function signInUrl(email: string, next: string): Promise<string> {
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) throw error ?? new Error('no sign-in token');
  return `${APP}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`;
}

/** Remove anything a previous run left behind. */
export async function resetData() {
  await db.from('businesses').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await db.from('sms_opt_outs').delete().neq('phone_e164', '');
}
