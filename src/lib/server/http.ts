import 'server-only';
import { NextResponse } from 'next/server';

export const ok = (data: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...data });
export const fail = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ ok: false, error, ...extra }, { status });

export async function body<T = Record<string, unknown>>(req: Request): Promise<Partial<T>> {
  try {
    const j = await req.json();
    return j && typeof j === 'object' ? (j as Partial<T>) : {};
  } catch {
    return {};
  }
}

/**
 * Small per-instance rate limit. Good enough to blunt form spam and code guessing;
 * claim codes are also limited in the database (5 tries).
 */
const hits = new Map<string, number[]>();
export function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
}

export const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
