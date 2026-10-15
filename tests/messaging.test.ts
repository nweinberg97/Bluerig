import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callWithCode, sendEmail, sendSms } from '../src/lib/messaging';

// A fetch that fails the test if anything tries to reach a real provider.
const noNetwork = (async () => {
  throw new Error('tried to reach the network');
}) as unknown as typeof fetch;

test('BR-02: in production, missing Twilio/Resend keys fail instead of pretending', async () => {
  const env = { NODE_ENV: 'production' };
  const sms = await sendSms('+16045550142', 'Your code is 123456', env, noNetwork);
  assert.equal(sms.ok, false);
  assert.equal(sms.logged, undefined);
  assert.equal((await callWithCode('+16045550142', '123456', env, noNetwork)).ok, false);
  assert.equal((await sendEmail('a@b.ca', 'Hi', 'Body', env, noNetwork)).ok, false);
});

test('in development, missing keys log the message instead', async () => {
  const env = { NODE_ENV: 'development' };
  const orig = console.log;
  const lines: string[] = [];
  console.log = (m: string) => lines.push(m);
  try {
    assert.deepEqual(await sendSms('+16045550142', 'hello', env, noNetwork), { ok: true, logged: true });
  } finally {
    console.log = orig;
  }
  assert.match(lines[0], /\[sms → \+16045550142\] hello/);
});

test('with keys, Twilio is called (mocked) and failures are reported', async () => {
  const env = { NODE_ENV: 'production', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM_NUMBER: '+16045550100' };
  const seen: string[] = [];
  const mock = (async (url: string) => {
    seen.push(String(url));
    return new Response('{}', { status: 400 });
  }) as unknown as typeof fetch;
  const r = await sendSms('+16045550142', 'hi', env, mock);
  assert.equal(r.ok, false);
  assert.match(seen[0], /api\.twilio\.com\/2010-04-01\/Accounts\/AC1\/Messages\.json/);
});

test('the test-only mock address is used only in E2E mode and never on Vercel', async () => {
  const base = { NODE_ENV: 'production', TWILIO_ACCOUNT_SID: 'AC1', TWILIO_AUTH_TOKEN: 't', TWILIO_FROM_NUMBER: '+16045550100', TWILIO_API_BASE: 'http://127.0.0.1:4010/twilio' };
  const urls: string[] = [];
  const mock = (async (url: string) => {
    urls.push(String(url));
    return new Response('{}', { status: 201 });
  }) as unknown as typeof fetch;
  await sendSms('+16045550142', 'a', base, mock);
  await sendSms('+16045550142', 'b', { ...base, BLUERIG_E2E: '1' }, mock);
  await sendSms('+16045550142', 'c', { ...base, BLUERIG_E2E: '1', VERCEL: '1' }, mock);
  assert.match(urls[0], /^https:\/\/api\.twilio\.com\//);
  assert.match(urls[1], /^http:\/\/127\.0\.0\.1:4010\/twilio\/2010-04-01\//);
  assert.match(urls[2], /^https:\/\/api\.twilio\.com\//);
});
