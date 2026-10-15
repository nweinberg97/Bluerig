import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactOf, requestPreview, siteHost, type PreviewDeps } from '../src/lib/preview/request';
import { shop } from './fixtures';

function fake(rows: Record<string, { id: string; token: string; claimed: boolean }> = {}) {
  const built: string[] = [];
  const sms: { to: string; body: string }[] = [];
  const mail: string[] = [];
  const hits = new Map<string, number>();
  const deps: PreviewDeps = {
    appUrl: 'https://bluerig.test',
    findByHost: async (h) => rows[h] ?? null,
    build: async (url, host) => {
      built.push(url);
      rows[host] = { id: 'b-new', token: 'tok-new', claimed: false };
      return { ...rows[host], profile: shop() };
    },
    sendSms: async (to, body) => (sms.push({ to, body }), { ok: true }),
    sendEmail: async (to) => (mail.push(to), { ok: true }),
    limited: (k, max) => {
      const n = (hits.get(k) ?? 0) + 1;
      hits.set(k, n);
      return n > max;
    },
  };
  return { deps, built, sms, mail };
}

test('typing a website builds a private preview and texts the link to the person', async () => {
  const f = fake();
  const r = await requestPreview(f.deps, { website: 'www.Northline.example/about', contact: '(604) 555-0123', ip: '1.1.1.1' });
  assert.equal(r.status, 200);
  assert.equal(r.body.previewPath, '/p/tok-new');
  assert.deepEqual(f.built, ['https://www.Northline.example/about']);
  assert.equal(f.sms[0].to, '+16045550123');
  assert.match(f.sms[0].body, /https:\/\/bluerig\.test\/p\/tok-new/);
  assert.match(f.sms[0].body, /Reply STOP/);
});

test('the same website gets the same preview (no duplicates)', async () => {
  const f = fake({ 'northline.example': { id: 'b1', token: 'tok-1', claimed: false } });
  const r = await requestPreview(f.deps, { website: 'northline.example', contact: 'me@example.ca', ip: '1.1.1.1' });
  assert.equal(r.body.previewPath, '/p/tok-1');
  assert.equal(f.built.length, 0);
  assert.deepEqual(f.mail, ['me@example.ca']);
});

test('a business that already has an owner cannot get a new preview', async () => {
  const f = fake({ 'northline.example': { id: 'b1', token: 'tok-1', claimed: true } });
  const r = await requestPreview(f.deps, { website: 'https://northline.example', contact: '604-555-0123', ip: '1.1.1.1' });
  assert.equal(r.status, 409);
  assert.match(String(r.body.error), /already has a Bluerig website/);
  assert.equal(r.body.previewPath, undefined);
  assert.equal(f.sms.length, 0);
});

test('bad input, rate limits and unreadable sites get plain messages', async () => {
  const f = fake();
  assert.equal((await requestPreview(f.deps, { website: 'not a site', contact: '604-555-0123', ip: 'x' })).status, 400);
  assert.equal((await requestPreview(f.deps, { website: 'shop.ca', contact: '555', ip: 'x' })).status, 400);
  for (let i = 0; i < 3; i++) await requestPreview(f.deps, { website: `shop${i}.ca`, contact: '604-555-0123', ip: 'y' });
  assert.equal((await requestPreview(f.deps, { website: 'shop9.ca', contact: '604-555-0123', ip: 'y' })).status, 429);
  const g = fake();
  g.deps.build = async () => {
    throw new Error('This website asks automated tools not to read it.');
  };
  const r = await requestPreview(g.deps, { website: 'shop.ca', contact: '604-555-0123', ip: 'z' });
  assert.equal(r.status, 422);
  assert.match(String(r.body.error), /asks automated tools/);
});

test('helpers', () => {
  assert.equal(siteHost('HTTP://WWW.Shop.CA/x?y'), 'shop.ca');
  assert.equal(siteHost('localhost'), null);
  assert.deepEqual(contactOf('1-604-555-0123'), { kind: 'sms', to: '+16045550123' });
  assert.deepEqual(contactOf('A@B.CA'), { kind: 'email', to: 'a@b.ca' });
  assert.equal(contactOf('hello'), null);
});
