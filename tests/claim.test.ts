import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALREADY_CLAIMED, startClaim, verifyClaim, type ClaimDeps, type StoredClaim } from '../src/lib/claim/flow';
import { claimSecret, hashCode } from '../src/lib/claim/codes';
import { shop } from './fixtures';

/** An in-memory stand-in for the database and message providers. Nothing real is sent. */
function fake(over: Partial<ClaimDeps> = {}) {
  const state = {
    owners: [] as string[],
    emails: { u_owner: 'owner@northline.example' } as Record<string, string>,
    claim: null as (StoredClaim & { sent_to: string }) | null,
    sms: [] as { to: string; body: string }[],
    calls: [] as { to: string; code: string }[],
    mail: [] as { to: string; subject: string }[],
    hits: new Map<string, number>(),
    logs: [] as string[],
  };
  const deps: ClaimDeps = {
    now: () => Date.parse('2026-10-14T20:00:00Z'),
    production: false,
    secret: 'test-secret',
    smsReady: true,
    newCode: () => '123456',
    findByToken: async (t) => (t === 'tok' ? { id: 'b1', status: 'preview', profile: shop() } : null),
    ownerIds: async () => state.owners.slice(),
    ownerEmails: async () => state.owners.map((o) => state.emails[o]).filter(Boolean),
    saveClaim: async (c) => {
      state.claim = { code_hash: c.code_hash, expires_at: c.expires_at, attempts: c.attempts, sent_to: c.sent_to };
    },
    getClaim: async () => state.claim,
    setAttempts: async (_b, n) => {
      if (state.claim) state.claim.attempts = n;
    },
    deleteClaim: async () => {
      state.claim = null;
    },
    addOwner: async (_b, u) => {
      if (state.owners.length) return false; // the one-owner index
      state.owners.push(u);
      return true;
    },
    sendSms: async (to, body) => (state.sms.push({ to, body }), { ok: true }),
    call: async (to, code) => (state.calls.push({ to, code }), { ok: true }),
    sendEmail: async (to, subject) => (state.mail.push({ to, subject }), { ok: true }),
    limited: (key, max) => {
      const n = (state.hits.get(key) ?? 0) + 1;
      state.hits.set(key, n);
      return n > max;
    },
    log: (m) => state.logs.push(m),
    ...over,
  };
  return { deps, state };
}

test('first claim: code texted to the shop, right code makes you the owner', async () => {
  const { deps, state } = fake();
  const s = await startClaim(deps, { userId: 'u_owner', token: 'tok' });
  assert.equal(s.status, 200);
  assert.equal(state.sms.length, 1);
  assert.equal(state.sms[0].to, '+16045550142');
  assert.match(state.sms[0].body, /123456/);
  assert.equal(state.claim!.code_hash, hashCode('test-secret', 'b1', '123456'));
  const v = await verifyClaim(deps, { userId: 'u_owner', token: 'tok', code: '123456' });
  assert.equal(v.status, 200);
  assert.deepEqual(state.owners, ['u_owner']);
  assert.equal(state.claim, null);
});

test('BR-01: a second person cannot claim a business that has an owner', async () => {
  const { deps, state } = fake();
  state.owners = ['u_owner'];
  const s = await startClaim(deps, { userId: 'u_intruder', token: 'tok' });
  assert.equal(s.status, 409);
  assert.equal(s.body.error, ALREADY_CLAIMED);
  assert.equal(state.sms.length, 0, 'no code is sent');
  assert.equal(state.claim, null);
});

test('BR-01: the owner is emailed about the attempt, at most once an hour', async () => {
  const { deps, state } = fake();
  state.owners = ['u_owner'];
  await startClaim(deps, { userId: 'u_intruder', token: 'tok' });
  await startClaim(deps, { userId: 'u_intruder', token: 'tok' });
  assert.equal(state.mail.length, 1);
  assert.equal(state.mail[0].to, 'owner@northline.example');
  assert.match(state.mail[0].subject, /Someone tried to claim Northline/);
});

test('BR-01: verify refuses a second owner even with a valid code', async () => {
  const { deps, state } = fake();
  // Intruder got a code before the real owner finished claiming...
  await startClaim(deps, { userId: 'u_intruder', token: 'tok' });
  // ...then the owner claimed first.
  state.owners = ['u_owner'];
  const v = await verifyClaim(deps, { userId: 'u_intruder', token: 'tok', code: '123456' });
  assert.equal(v.status, 409);
  assert.deepEqual(state.owners, ['u_owner']);
});

test('BR-01: if two people verify at once, the database decides and the loser gets 409', async () => {
  const { deps, state } = fake({ ownerIds: async () => [] }); // both see "no owner yet"
  await startClaim(deps, { userId: 'a', token: 'tok' });
  state.owners = ['someone-else']; // won the race in the database
  const v = await verifyClaim(deps, { userId: 'a', token: 'tok', code: '123456' });
  assert.equal(v.status, 409);
});

test('the owner asking again is sent straight to the editor', async () => {
  const { deps, state } = fake();
  state.owners = ['u_owner'];
  const s = await startClaim(deps, { userId: 'u_owner', token: 'tok' });
  assert.equal(s.status, 200);
  assert.equal(s.body.alreadyOwner, true);
  assert.equal(state.mail.length, 0);
});

test('wrong codes count, and five wrong codes lock it', async () => {
  const { deps, state } = fake();
  await startClaim(deps, { userId: 'a', token: 'tok' });
  for (let i = 0; i < 5; i++) assert.equal((await verifyClaim(deps, { userId: 'a', token: 'tok', code: '000000' })).status, 400);
  const v = await verifyClaim(deps, { userId: 'a', token: 'tok', code: '123456' });
  assert.match(String(v.body.error), /Too many tries/);
  assert.deepEqual(state.owners, []);
});

test('expired codes and landlines', async () => {
  const { deps, state } = fake();
  await startClaim(deps, { userId: 'a', token: 'tok', channel: 'call' });
  assert.equal(state.calls.length, 1);
  assert.equal(state.sms.length, 0);
  const later = { ...deps, now: () => deps.now() + 16 * 60 * 1000 };
  assert.match(String((await verifyClaim(later, { userId: 'a', token: 'tok', code: '123456' })).body.error), /expired/);
});

test('BR-02: production without CLAIM_SECRET refuses with 503', async () => {
  const { deps, state } = fake({ production: true, secret: null });
  assert.equal((await startClaim(deps, { userId: 'a', token: 'tok' })).status, 503);
  assert.equal((await verifyClaim(deps, { userId: 'a', token: 'tok', code: '123456' })).status, 503);
  assert.equal(state.sms.length, 0);
  assert.match(state.logs.join(), /CLAIM_SECRET/);
});

test('BR-02: production without Twilio refuses with 503 and never says "sent"', async () => {
  const { deps, state } = fake({ production: true, smsReady: false });
  const s = await startClaim(deps, { userId: 'a', token: 'tok' });
  assert.equal(s.status, 503);
  assert.equal(s.body.ok, false);
  assert.equal(state.claim, null, 'no code is stored');
  assert.equal(state.sms.length, 0);
});

test('BR-02: the claim secret is required in production and optional in development', () => {
  assert.equal(claimSecret({ NODE_ENV: 'production', SUPABASE_SERVICE_ROLE_KEY: 'svc' }), null);
  assert.equal(claimSecret({ NODE_ENV: 'production', CLAIM_SECRET: 's3' }), 's3');
  assert.equal(claimSecret({ NODE_ENV: 'development', SUPABASE_SERVICE_ROLE_KEY: 'svc' }), 'svc');
  assert.equal(claimSecret({ NODE_ENV: 'development' }), 'dev-only-secret');
});

test('BR-02: the server refuses to start in production without CLAIM_SECRET', async () => {
  const { register } = await import('../src/instrumentation');
  const saved = { ...process.env };
  const set = (env: Record<string, string | undefined>) => {
    for (const k of ['NEXT_RUNTIME', 'NODE_ENV', 'NEXT_PHASE', 'CLAIM_SECRET']) {
      if (env[k] === undefined) delete process.env[k];
      else process.env[k] = env[k];
    }
  };
  try {
    set({ NEXT_RUNTIME: 'nodejs', NODE_ENV: 'production' });
    assert.throws(() => register(), /CLAIM_SECRET is not set/);
    set({ NEXT_RUNTIME: 'nodejs', NODE_ENV: 'production', CLAIM_SECRET: 'x' });
    assert.doesNotThrow(() => register());
    set({ NEXT_RUNTIME: 'nodejs', NODE_ENV: 'production', NEXT_PHASE: 'phase-production-build' });
    assert.doesNotThrow(() => register(), 'next build still works');
    set({ NEXT_RUNTIME: 'nodejs', NODE_ENV: 'development' });
    assert.doesNotThrow(() => register());
  } finally {
    process.env = saved;
  }
});
