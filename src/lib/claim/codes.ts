// Claim codes: 6 digits, stored only as an HMAC. No framework imports so it's testable.
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** The secret used to hash codes. */
export function claimSecret(env: Record<string, string | undefined> = process.env): string | null {
  return env.CLAIM_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only-secret';
}

export const hashCode = (secret: string, businessId: string, code: string) => createHmac('sha256', secret).update(`${businessId}:${code}`).digest('hex');

export function codeMatches(secret: string, businessId: string, code: string, hash: string): boolean {
  const a = Buffer.from(hashCode(secret, businessId, code), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
