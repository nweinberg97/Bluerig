import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractAll, findHours, pickColours, splitName, type PageText } from '../src/lib/import/extract';
import { buildProfile } from '../src/lib/import/build-profile';
import { isAllowed } from '../src/lib/import/robots';
import { validateProfile } from '../src/lib/profile';

const page = (url: string, over: Partial<PageText>): PageText => ({
  url, title: '', metaDescription: '', ogSiteName: '', ogImage: '', themeColor: '', headings: [], text: '',
  telLinks: [], mailLinks: [], links: [], logoCandidates: [], colours: {}, ...over,
});

// A made-up shop's old website.
const PAGES: PageText[] = [
  page('https://northline.example/', {
    title: 'Home | Northline Mechanical Ltd.',
    headings: ['Furnace repair and installation', 'Heat Pumps', 'Hot Water Tanks'],
    text: `Northline Mechanical has kept Tri-Cities homes warm since 2004. Family-owned and fully licensed and insured.
      We install high-efficiency furnaces that cut your heating bill. Heat pumps keep you cool in summer and warm in winter.
      Same-day hot water tank replacement for homes in Port Coquitlam, Coquitlam, Port Moody and Maple Ridge.
      24/7 emergency service. Diagnostic fee only $89. Call 604-555-0142.`,
    telLinks: ['tel:+16045550142'],
    logoCandidates: [{ src: 'https://northline.example/logo.png', score: 5 }],
    colours: { '#1f6f8b': 40, '#fff': 200, '#f2a03d': 12, '#0d1b24': 8, 'rgb(31, 111, 139)': 5 },
    links: [{ href: 'https://g.page/r/northline/review', text: 'Review us' }],
  }),
  page('https://northline.example/contact', {
    title: 'Contact | Northline Mechanical Ltd.',
    text: 'Northline Mechanical, 1234 Example Ave, Port Coquitlam, BC V3B 0A1. Hours: Mon-Fri 7:30am-4:30pm, Sat 9-1, Sun closed.',
    mailLinks: ['mailto:Office@Northline.example'],
  }),
];

test('finds the basics from a typical shop site', () => {
  const x = extractAll(PAGES);
  assert.equal(x.name?.value, 'Northline');
  assert.equal(x.tagline?.value, 'Mechanical');
  assert.equal(x.phone?.value, '604-555-0142');
  assert.equal(x.email?.value, 'office@northline.example');
  assert.equal(x.city?.value, 'Port Coquitlam');
  assert.equal(x.province?.value, 'BC');
  assert.deepEqual(x.towns?.value, ['Port Coquitlam', 'Coquitlam', 'Port Moody', 'Maple Ridge']);
  assert.deepEqual(x.services.map((s) => s.value.name), ['Furnaces', 'Heat pumps', 'Hot water tanks']);
  assert.match(x.services[0].value.blurb, /high-efficiency furnaces/);
  assert.equal(x.logoUrl?.value, 'https://northline.example/logo.png');
  assert.deepEqual(x.colours?.value, { primary: '#1F6F8B', accent: '#F2A03D', ink: '#0D1B24' });
  assert.equal(x.yearFounded?.value, 2004);
  assert.equal(x.prices[0].value.amount, 89);
  assert.equal(x.reviewsUrl?.value, 'https://g.page/r/northline/review');
});

test('hours, including ranges, half hours and closed days', () => {
  const h = findHours(PAGES)!.value;
  assert.deepEqual(h.Mon, [7.5, 16.5]);
  assert.deepEqual(h.Fri, [7.5, 16.5]);
  assert.deepEqual(h.Sat, [9, 13]);
  assert.equal(h.Sun, null);
});

test('claims found on the old site stay off until the owner confirms', () => {
  const { profile, warnings } = buildProfile(extractAll(PAGES), 'https://northline.example/');
  assert.equal(profile.facts.emergency247, false);
  assert.equal(profile.facts.licensedInsured, false);
  assert.equal(profile.facts.yearFounded, null);
  assert.ok(profile.confirm.emergency && profile.confirm.licence && profile.confirm.hours);
  assert.ok(warnings.some((w) => /2004/.test(w)));
  assert.equal(profile.timezone, 'America/Vancouver');
  assert.equal(profile.copy.kicker, 'Heating · Cooling · Plumbing');
  assert.deepEqual(validateProfile(profile), []);
});

test('an empty site still gives a valid starting draft', () => {
  const { profile, warnings } = buildProfile(extractAll([page('https://x.example/', {})]), 'https://x.example/');
  assert.deepEqual(validateProfile(profile), []);
  assert.ok(warnings.length >= 2);
});

test('names', () => {
  assert.deepEqual(splitName('Greenfield Plumbing & Heating Inc.'), { name: 'Greenfield', tagline: 'Plumbing & Heating' });
  assert.deepEqual(splitName('Acme'), { name: 'Acme', tagline: '' });
});

test('colours ignore greys', () => {
  assert.equal(pickColours({ '#ffffff': 100, '#333': 50 }), null);
});

test('robots.txt is respected', () => {
  const r = 'User-agent: *\nDisallow: /private\nAllow: /private/ok\n\nUser-agent: BadBot\nDisallow: /';
  assert.ok(isAllowed(r, '/'));
  assert.ok(!isAllowed(r, '/private/x'));
  assert.ok(isAllowed(r, '/private/ok'));
  assert.ok(!isAllowed('User-agent: *\nDisallow: /', '/contact'));
  assert.ok(!isAllowed('User-agent: BluerigBot\nDisallow: /\n\nUser-agent: *\nAllow: /', '/'));
  assert.ok(isAllowed(null, '/'));
  assert.ok(isAllowed('User-agent: *\nDisallow:', '/'));
});
