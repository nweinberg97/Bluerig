import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publishChecks, markPhotoRights } from '../src/lib/checks';
import { addArea, normalizeArea, validateProfile } from '../src/lib/profile';
import { jsonLd, metaDescription } from '../src/lib/seo';
import { reviewRequestText, reviewLink, toE164 } from '../src/lib/reviews';
import { shop, NOW } from './fixtures';

test('a clean profile validates', () => {
  assert.deepEqual(validateProfile(shop()), []);
});

test('changed prices and new claims ask for a second look', () => {
  const live = shop();
  const draft = shop({ prices: [{ id: 'p1', label: 'Diagnostic fee', amount: 119 }] });
  draft.copy.intro = 'Licensed, insured and available 24/7.';
  const r = publishChecks(draft, live);
  assert.deepEqual(r.blocking, []);
  const kinds = r.confirm.map((c) => c.kind).sort();
  assert.deepEqual(kinds, ['claim', 'claim', 'claim', 'price']);
  assert.match(r.confirm.find((c) => c.kind === 'price')!.text, /\$119 \(was \$89\)/);
});

test('unchanged things are not re-asked', () => {
  assert.deepEqual(publishChecks(shop(), shop()).confirm, []);
});

test('work photos need a rights tick, once', () => {
  const draft = shop({ jobs: [{ id: 'j1', photoUrl: 'https://x/y.jpg', caption: 'New furnace in Coquitlam', date: '2026-10-11', photoRights: false }] });
  const r = publishChecks(draft, shop());
  assert.equal(r.confirm.length, 1);
  const fixed = markPhotoRights(draft, r.confirm.map((c) => c.id));
  assert.deepEqual(publishChecks(fixed, shop()).confirm, []);
});

test('bad input is blocking', () => {
  const p = shop({ prices: [{ id: 'x', label: 'Diag', amount: -5 }] });
  p.brand.primary = 'green';
  assert.equal(publishChecks(p, null).blocking.length, 2);
});

test('areas: towns get tidied, postal codes cut to 3 characters', () => {
  assert.equal(normalizeArea('  north   vancouver '), 'North Vancouver');
  assert.equal(normalizeArea('v3b 2k1'), 'V3B');
  assert.equal(normalizeArea('V3B'), 'V3B');
  assert.equal(normalizeArea(''), null);
  assert.deepEqual(addArea(['Burnaby'], 'burnaby'), ['Burnaby']);
});

test('Google sees areas served, including postal areas', () => {
  const p = shop({ towns: ['Port Coquitlam', 'V3E'] });
  const ld = jsonLd(p, 'https://northline.bluerig.ca', NOW) as any;
  assert.equal(ld['@type'], 'HVACBusiness');
  assert.deepEqual(ld.areaServed[0], { '@type': 'City', name: 'Port Coquitlam, British Columbia' });
  assert.equal(ld.areaServed[1].postalCodeBegin, 'V3E');
  assert.equal(ld.makesOffer[0].price, 89);
  assert.equal(ld.aggregateRating, undefined);
  assert.match(metaDescription(p), /Port Coquitlam\. Call 604-555-0142/);
});

test('review request identifies the sender and offers opt-out (CASL)', () => {
  const t = reviewRequestText(shop(), { firstName: 'Dana Smith', link: reviewLink('abc') });
  assert.match(t, /^Hi Dana, thanks for choosing Northline/);
  assert.match(t, /writereview\?placeid=abc/);
  assert.match(t, /Northline 604-555-0142\. Reply STOP to opt out\.$/);
  assert.equal(toE164('(604) 555-0142'), '+16045550142');
  assert.equal(toE164('555-0142'), null);
});
