// Wires the claim rules (lib/claim/flow.ts) to Supabase, Twilio and Resend.
import 'server-only';
import type { ClaimDeps } from '../claim/flow';
import { claimSecret, newCode } from '../claim/codes';
import { callWithCode, sendEmail, sendSms, smsConfigured } from '../messaging';
import { adminClient } from '../supabase/server';
import { byPreviewToken, ownerIds } from './db';
import { limited } from './http';

export function claimDeps(): ClaimDeps {
  const sb = adminClient();
  return {
    now: () => Date.now(),
    production: process.env.NODE_ENV === 'production',
    secret: claimSecret(),
    smsReady: smsConfigured(),
    newCode,
    async findByToken(token) {
      const row = await byPreviewToken(token);
      return row ? { id: row.id, status: row.status, profile: row.published ?? row.draft } : null;
    },
    ownerIds,
    async ownerEmails(businessId) {
      const ids = await ownerIds(businessId);
      const users = await Promise.all(ids.map((id) => sb.auth.admin.getUserById(id)));
      return users.map((u) => u.data.user?.email).filter((e): e is string => !!e);
    },
    async saveClaim(c) {
      await sb.from('claims').upsert(c);
    },
    async getClaim(businessId) {
      const { data } = await sb.from('claims').select('code_hash, expires_at, attempts').eq('business_id', businessId).maybeSingle();
      return data ?? null;
    },
    async setAttempts(businessId, n) {
      await sb.from('claims').update({ attempts: n }).eq('business_id', businessId);
    },
    async deleteClaim(businessId) {
      await sb.from('claims').delete().eq('business_id', businessId);
    },
    async addOwner(businessId, userId) {
      const { error } = await sb.from('members').insert({ business_id: businessId, user_id: userId, role: 'owner' });
      // 23505 = unique violation: someone else became the owner first.
      return !error;
    },
    sendSms: (to, body) => sendSms(to, body),
    call: (to, code) => callWithCode(to, code),
    sendEmail: (to, subject, text) => sendEmail(to, subject, text),
    limited,
    log: (msg) => console.error(`[claim] ${msg}`),
  };
}
