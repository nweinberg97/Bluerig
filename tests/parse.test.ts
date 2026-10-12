import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRules } from '../src/lib/parse-rules';
import { applyProposal, sanitizeProposal } from '../src/lib/changes';
import { shop, NOW } from './fixtures';

const P = (s: string) => parseRules(s, shop(), NOW)?.proposal;

test('phone numbers', () => {
  assert.deepEqual(P('new phone number 604 555 0199'), { kind: 'phone', phone: '604 555 0199' });
});

test('holidays', () => {
  assert.deepEqual(P('closed dec 24-26'), { kind: 'holiday', from: '2026-12-24', to: '2026-12-26', closed: true, label: 'Holiday hours' });
  assert.deepEqual(P("We're closed Dec 31 to Jan 2"), { kind: 'holiday', from: '2026-12-31', to: '2027-01-02', closed: true, label: 'Holiday hours' });
});

test('emergency mode on and off', () => {
  assert.deepEqual(P('emergency crew available tonight'), { kind: 'status', status: 'emergency', until: 'tonight' });
  assert.deepEqual(P('taking emergency calls till tomorrow morning'), { kind: 'status', status: 'emergency', until: 'morning' });
  assert.deepEqual(P('turn off emergency'), { kind: 'status', status: 'normal' });
  assert.deepEqual(P('we are booked solid'), { kind: 'status', status: 'booked', until: 'week' });
});

test('prices update the matching line', () => {
  const r = parseRules('diagnostic fee is now $119', shop(), NOW)!;
  assert.deepEqual(r.proposal, { kind: 'price', label: 'Diagnostic fee', amount: 119 });
  assert.match(r.message, /\$89 → \$119/);
  const q = applyProposal(shop(), r.proposal, NOW);
  assert.equal(q.prices.length, 1);
  assert.equal(q.prices[0].amount, 119);
});

test('a new price line', () => {
  assert.deepEqual(P('service call $95'), { kind: 'price', label: 'Service call', amount: 95 });
});

test('deals are not prices', () => {
  const p = P('$50 off furnace tune-ups until nov 30');
  assert.equal(p?.kind, 'special');
  assert.deepEqual(p, { kind: 'special', title: '$50 off furnace tune-ups', ends: '2026-11-30' });
});

test('service areas: towns and postal codes', () => {
  assert.deepEqual(P('we now serve North Vancouver'), { kind: 'addArea', area: 'North Vancouver' });
  assert.deepEqual(P('add V3E 1A1 to our area'), { kind: 'addArea', area: 'V3E' });
  assert.deepEqual(P('stop going to Coquitlam'), { kind: 'removeArea', area: 'Coquitlam' });
  assert.deepEqual(P('we serve Belcarra too'), { kind: 'addArea', area: 'Belcarra' });
  const q = applyProposal(shop(), { kind: 'addArea', area: 'V3E' }, NOW);
  assert.deepEqual(q.towns, ['Port Coquitlam', 'Coquitlam', 'V3E']);
});

test('new service', () => {
  assert.deepEqual(P('we now do heat pump installs'), { kind: 'addService', name: 'Heat pump installation' });
});

test('photos, reviews and unknowns', () => {
  assert.deepEqual(P('post a before and after'), { kind: 'open', panel: 'photos' });
  assert.deepEqual(P('ask for a review'), { kind: 'open', panel: 'reviews' });
  assert.equal(P('hello there'), undefined);
});

test('model output is re-validated', () => {
  assert.equal(sanitizeProposal({ kind: 'phone', phone: '123' }), null);
  assert.equal(sanitizeProposal({ kind: 'delete_everything' }), null);
  assert.deepEqual(sanitizeProposal({ kind: 'status', status: 'emergency' }), { kind: 'status', status: 'emergency', until: 'tonight' });
  assert.deepEqual(sanitizeProposal({ kind: 'price', label: 'Diagnostic', amount: 119.999 }), { kind: 'price', label: 'Diagnostic', amount: 120 });
  assert.equal(sanitizeProposal({ kind: 'addArea', area: '<script>' }), null);
});
