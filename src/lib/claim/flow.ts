// Claiming a business: the owner gets a 6-digit code at the shop's listed phone and
// becomes the owner. Written against small injected functions (no framework or
// database imports) so every rule here is unit-tested.
//
// Rules:
// - A business with an owner can't be claimed again. The owners get an email when
//   someone tries (at most one an hour), and the attempt is refused.
// - The database also allows only one owner per business (migration 0002), so two
//   people verifying at the same moment can't both win.

import type { BusinessProfile } from '../profile';
import { toE164 } from '../reviews';
import { codeMatches, hashCode } from './codes';

export interface ClaimRow {
  id: string;
  status: 'preview' | 'live' | 'archived';
  profile: BusinessProfile;
}
export interface StoredClaim {
  code_hash: string;
  expires_at: string;
  attempts: number;
}

export interface ClaimDeps {
  now(): number;
  production: boolean;
  /** null = not set up (production without CLAIM_SECRET). */
  secret: string | null;
  smsReady: boolean;
  newCode(): string;
  findByToken(token: string): Promise<ClaimRow | null>;
  ownerIds(businessId: string): Promise<string[]>;
  ownerEmails(businessId: string): Promise<string[]>;
  saveClaim(c: { business_id: string; code_hash: string; expires_at: string; attempts: number; sent_to: string }): Promise<void>;
  getClaim(businessId: string): Promise<StoredClaim | null>;
  setAttempts(businessId: string, n: number): Promise<void>;
  deleteClaim(businessId: string): Promise<void>;
  /** Returns false if the database refused a second owner. */
  addOwner(businessId: string, userId: string): Promise<boolean>;
  sendSms(to: string, body: string): Promise<{ ok: boolean }>;
  call(to: string, code: string): Promise<{ ok: boolean }>;
  sendEmail(to: string, subject: string, text: string): Promise<{ ok: boolean }>;
  /** true = over the limit */
  limited(key: string, max: number, windowMs: number): boolean;
  log(msg: string): void;
}

export interface Result {
  status: number;
  body: Record<string, unknown>;
}
const ok = (body: Record<string, unknown> = {}): Result => ({ status: 200, body: { ok: true, ...body } });
const fail = (error: string, status = 400, extra: Record<string, unknown> = {}): Result => ({ status, body: { ok: false, error, ...extra } });

const NOT_SET_UP = 'Claiming isn’t available right now. Please contact Bluerig and we’ll sort it out.';
export const ALREADY_CLAIMED = 'This business already has an owner on Bluerig. If that’s you, sign in with the email you used before. If not, contact Bluerig.';
const CODE_MINUTES = 15;

/** Tell the owners someone tried to claim their business (at most once an hour). */
async function alertOwners(d: ClaimDeps, row: ClaimRow) {
  if (d.limited(`claim-alert:${row.id}`, 1, 60 * 60 * 1000)) return;
  const emails = await d.ownerEmails(row.id);
  const name = row.profile.brand.name;
  await Promise.all(
    emails.map((to) =>
      d.sendEmail(
        to,
        `Someone tried to claim ${name} on Bluerig`,
        `Hi,\n\nSomeone just tried to claim ${name} on Bluerig. We blocked it, because you're already the owner.\n\nIf this was you or someone on your team, you can ignore this email. If not, reply to this email and we'll look into it.\n\nNothing on your website has changed.\n\n— Bluerig`,
      ),
    ),
  );
}

export async function startClaim(d: ClaimDeps, input: { userId: string; token: string; channel?: string }): Promise<Result> {
  if (!d.secret) {
    d.log('claim refused: CLAIM_SECRET is not set');
    return fail(NOT_SET_UP, 503);
  }
  const row = await d.findByToken(input.token);
  if (!row) return fail('This preview link has expired.', 404);

  const owners = await d.ownerIds(row.id);
  if (owners.includes(input.userId)) return ok({ alreadyOwner: true, businessId: row.id });
  if (owners.length) {
    await alertOwners(d, row);
    return fail(ALREADY_CLAIMED, 409);
  }
  if (row.status === 'live') return fail(ALREADY_CLAIMED, 409);

  const to = toE164(row.profile.phone);
  if (!to) return fail('There’s no phone number on this site to send a code to. Contact Bluerig and we’ll verify you another way.');
  if (d.limited(`claim:${row.id}`, 4, 60 * 60 * 1000)) return fail('Too many codes sent. Try again in an hour.', 429);

  const code = d.newCode();
  await d.saveClaim({
    business_id: row.id,
    code_hash: hashCode(d.secret, row.id, code),
    expires_at: new Date(d.now() + CODE_MINUTES * 60 * 1000).toISOString(),
    attempts: 0,
    sent_to: to,
  });
  if (input.channel === 'call') {
    const r = await d.call(to, code);
    if (!r.ok) return fail('We couldn’t place the call. Try a text instead.', 502);
  } else {
    const r = await d.sendSms(to, `Your Bluerig code for ${row.profile.brand.name} is ${code}. It expires in ${CODE_MINUTES} minutes. If you didn’t ask for this, ignore it.`);
    if (!r.ok) return fail('We couldn’t text that number. If it’s a landline, choose “Call me instead”.', 502);
  }
  return ok();
}

export async function verifyClaim(d: ClaimDeps, input: { userId: string; token: string; code: string }): Promise<Result> {
  if (!d.secret) {
    d.log('claim refused: CLAIM_SECRET is not set');
    return fail(NOT_SET_UP, 503);
  }
  const row = await d.findByToken(input.token);
  if (!row) return fail('This preview link has expired.', 404);

  const owners = await d.ownerIds(row.id);
  if (owners.includes(input.userId)) return ok({ businessId: row.id });
  if (owners.length) {
    await alertOwners(d, row);
    return fail(ALREADY_CLAIMED, 409);
  }

  const c = await d.getClaim(row.id);
  if (!c) return fail('Ask for a code first.');
  if (new Date(c.expires_at).getTime() < d.now()) return fail('That code expired. Ask for a new one.');
  if (c.attempts >= 5) return fail('Too many tries. Ask for a new code.');
  if (!/^\d{6}$/.test(input.code) || !codeMatches(d.secret, row.id, input.code, c.code_hash)) {
    await d.setAttempts(row.id, c.attempts + 1);
    return fail('That code didn’t match.');
  }
  // The database allows one owner per business, so a race is settled there.
  if (!(await d.addOwner(row.id, input.userId))) return fail(ALREADY_CLAIMED, 409);
  await d.deleteClaim(row.id);
  return ok({ businessId: row.id });
}
