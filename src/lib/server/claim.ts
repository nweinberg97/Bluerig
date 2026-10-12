import 'server-only';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

const secret = () => process.env.CLAIM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only-secret';
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const hashCode = (businessId: string, code: string) => createHmac('sha256', secret()).update(`${businessId}:${code}`).digest('hex');
export function codeMatches(businessId: string, code: string, hash: string): boolean {
  const a = Buffer.from(hashCode(businessId, code), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
