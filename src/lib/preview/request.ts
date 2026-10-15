// "Type your website, see your new one": anyone can ask for a preview of a shop's
// website. That's safe because a preview only uses the shop's own public website
// and changes nothing. OWNING it is the locked step: claiming always needs the
// code sent to the phone number on the shop's website (see lib/claim/flow.ts).
//
// - The same website gets the same preview (no duplicates).
// - A business that already has an owner can't get a new preview: we say so.
// - The link is also sent to the contact the person typed (theirs), rate-limited.

import type { BusinessProfile } from '../profile';

export interface PreviewRow {
  id: string;
  token: string;
  claimed: boolean;
}

export interface PreviewDeps {
  appUrl: string;
  findByHost(host: string): Promise<PreviewRow | null>;
  /** Reads the website and creates a private preview; throws { message } for a site we can't read. */
  build(url: string, host: string, requestedBy: string): Promise<PreviewRow & { profile: BusinessProfile }>;
  sendSms(to: string, body: string): Promise<{ ok: boolean }>;
  sendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean }>;
  limited(key: string, max: number, windowMs: number): boolean;
}

export interface PreviewResult {
  status: number;
  body: Record<string, unknown>;
}

/** "https://www.Shop.ca/about" → "shop.ca" (null if it isn't a website). */
export function siteHost(input: string): string | null {
  let s = input.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) ? h : null;
  } catch {
    return null;
  }
}

/** A mobile number (as +1…) or an email address the person typed, or null. */
export function contactOf(input: string): { kind: 'sms'; to: string } | { kind: 'email'; to: string } | null {
  const s = input.trim();
  if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s)) return { kind: 'email', to: s.toLowerCase() };
  const d = s.replace(/\D/g, '');
  if (d.length === 10) return { kind: 'sms', to: `+1${d}` };
  if (d.length === 11 && d.startsWith('1')) return { kind: 'sms', to: `+${d}` };
  return null;
}

const fail = (error: string, status = 400, extra: Record<string, unknown> = {}): PreviewResult => ({ status, body: { ok: false, error, ...extra } });

export async function requestPreview(d: PreviewDeps, input: { website: string; contact: string; ip: string }): Promise<PreviewResult> {
  const host = siteHost(input.website);
  if (!host) return fail('Please type your current website, like yourshop.ca.');
  const contact = contactOf(input.contact);
  if (!contact) return fail('Please add a mobile number or email, so we can send you the link.');
  if (d.limited(`preview:ip:${input.ip}`, 3, 60 * 60 * 1000)) return fail('You’ve asked for a few previews already. Please try again in an hour.', 429);
  if (d.limited('preview:all', 60, 60 * 60 * 1000)) return fail('We’re busy building websites right now. Please try again in a few minutes.', 429);

  let row = await d.findByHost(host);
  if (row?.claimed) {
    return fail('This business already has a Bluerig website. If it’s yours, sign in with the email you used.', 409, { signIn: '/login' });
  }
  if (!row) {
    try {
      const raw = input.website.trim();
      row = await d.build(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`, host, `${contact.kind}:${contact.to}`);
    } catch (e) {
      return fail((e as Error).message || 'We couldn’t read that website. Check the address and try again.', 422);
    }
  }

  const path = `/p/${row.token}`;
  const link = `${d.appUrl.replace(/\/$/, '')}${path}`;
  // Send them the link too, so they can open it later on their phone.
  if (!d.limited(`preview:send:${contact.to}`, 3, 24 * 3600 * 1000)) {
    if (contact.kind === 'sms') await d.sendSms(contact.to, `Here’s your new website preview from Bluerig: ${link}\nOnly people with this link can see it. Reply STOP to opt out.`);
    else await d.sendEmail(contact.to, 'Your new website preview', `Hi,\n\nHere’s the preview of your new website:\n${link}\n\nOnly people with this link can see it. Nothing changes on your current website unless you decide to keep the new one.\n\n— Bluerig`);
  }
  return { status: 200, body: { ok: true, previewPath: path } };
}
