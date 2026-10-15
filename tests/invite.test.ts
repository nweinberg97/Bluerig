import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inviteEditor, type InviteDeps } from '../src/lib/team/invite';

function fake(existing: string[] = [], emailOk = true) {
  const users = new Map(existing.map((e, i) => [e, `u${i}`]));
  const sent: { to: string; subject: string; text: string }[] = [];
  const editors: string[] = [];
  const deps: InviteDeps = {
    appUrl: 'https://app.bluerig.test',
    ensureUser: async (email) => {
      if (!users.has(email)) users.set(email, `u${users.size}`);
      return users.get(email)!;
    },
    signInToken: async () => 'tok123',
    addEditor: async (_b, u) => (editors.push(u), true),
    sendEmail: async (to, subject, text) => (sent.push({ to, subject, text }), { ok: emailOk }),
  };
  return { deps, sent, editors, users };
}
const input = { businessId: 'b1', businessName: 'Northline', inviterEmail: 'owner@northline.example' };

test('BR-06: someone who already has an account gets the invite email (mocked)', async () => {
  const f = fake(['tech@northline.example']);
  const r = await inviteEditor(f.deps, { ...input, email: 'Tech@Northline.example' });
  assert.equal(r.status, 200);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].to, 'tech@northline.example');
  assert.match(f.sent[0].subject, /edit the Northline website/);
  assert.match(f.sent[0].text, /https:\/\/app\.bluerig\.test\/auth\/callback\?token_hash=tok123&type=magiclink&next=%2Fedit%2Fb1/);
  assert.match(f.sent[0].text, /owner@northline\.example invited you/);
  assert.deepEqual(f.editors, ['u0']);
});

test('BR-06: someone new gets an account and the same email', async () => {
  const f = fake();
  const r = await inviteEditor(f.deps, { ...input, email: 'new@example.ca' });
  assert.equal(r.status, 200);
  assert.ok(f.users.has('new@example.ca'));
  assert.equal(f.sent.length, 1);
});

test('BR-06: if the email fails, say so (they are still added)', async () => {
  const f = fake([], false);
  const r = await inviteEditor(f.deps, { ...input, email: 'new@example.ca' });
  assert.equal(r.status, 502);
  assert.equal(r.body.added, true);
  assert.match(String(r.body.error), /didn’t send/);
});

test('BR-06: bad emails are refused before anything happens', async () => {
  const f = fake();
  const r = await inviteEditor(f.deps, { ...input, email: 'not-an-email' });
  assert.equal(r.status, 400);
  assert.equal(f.sent.length + f.editors.length + f.users.size, 0);
});
