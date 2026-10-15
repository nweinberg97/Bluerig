import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { Site } from '../src/components/Site';
import { shop, NOW } from './fixtures';

const later = new Date(NOW.getTime() + 3600e3).toISOString();

test('live site: emergency bar, prices, work photos, areas and call links', () => {
  const p = shop({
    availability: { kind: 'emergency', until: later },
    towns: ['Port Coquitlam', 'Coquitlam', 'V3E'],
    jobs: [{ id: 'j', photoUrl: 'https://x.supabase.co/a.jpg', beforeUrl: 'https://x.supabase.co/b.jpg', caption: 'New furnace', town: 'Coquitlam', date: '2026-10-10', photoRights: true }],
  });
  const html = renderToStaticMarkup(<Site profile={p} mode="live" now={NOW} businessId="b" />);
  assert.match(html, /Taking emergency calls right now/);
  assert.match(html, /href="tel:\+16045550142"/);
  assert.match(html, /Diagnostic fee/);
  assert.match(html, /\$89/);
  assert.match(html, /Recent work/);
  assert.match(html, />Before</);
  assert.match(html, /Postal areas V3E/);
  assert.doesNotMatch(html, /contenteditable/i);
  assert.doesNotMatch(html, /Check this/);
});

test('expired emergency bar does not show', () => {
  const p = shop({ availability: { kind: 'emergency', until: '2026-10-01T00:00:00Z' } });
  assert.doesNotMatch(renderToStaticMarkup(<Site profile={p} mode="live" now={NOW} />), /Taking emergency calls/);
});

test('edit mode marks words editable and blocks clickable', () => {
  const html = renderToStaticMarkup(<Site profile={shop()} mode="edit" now={NOW} />);
  assert.match(html, /data-k="copy.headlineA"/);
  assert.match(html, /contentEditable="plaintext-only"|contenteditable="plaintext-only"/);
  assert.match(html, /data-panel="prices"/);
  assert.match(html, /data-panel="photos"/);
  assert.match(html, /Add a photo of a job/);
});

test('preview shows things to check and the unsolicited-preview notice; claims stay off', () => {
  const p = shop({ confirm: { hours: { label: 'Hours', detail: 'Old site' }, licence: { label: 'Licensed', detail: 'Old site' } } });
  const html = renderToStaticMarkup(<Site profile={p} mode="preview" now={NOW} />);
  assert.match(html, /Check this/);
  assert.match(html, /Licensed &amp; insured\?/);
  assert.match(html, /Private preview made by Bluerig/);
  assert.doesNotMatch(html, /Licensed &amp; insured<\/span>/);
});

test('brand colours that are too light still give readable buttons', () => {
  const p = shop();
  p.brand.primary = '#9BE7A0';
  const html = renderToStaticMarkup(<Site profile={p} mode="live" now={NOW} />);
  const g = html.match(/--g:(#[0-9A-F]{6})/)![1];
  assert.notEqual(g, '#9BE7A0');
});

import { ClaimFlow, ClaimSteps } from '../src/app/p/[token]/ClaimFlow';

test('the link shows the whole website first, with one clear next step', () => {
  const html = renderToStaticMarkup(<ClaimFlow token="t" signedIn={false} claimed={false} canEdit={false} businessId="b1" profile={shop()} />);
  assert.match(html, /This is your new website\./);
  assert.match(html, /Edit my website/);
  assert.match(html, /class="site /); // the real site is on the page
  assert.doesNotMatch(html, /Check this/); // no "to check" clutter on first view
});

test('BR-01: a claimed link is view-only (no way to claim)', () => {
  const stranger = renderToStaticMarkup(<ClaimFlow token="t" signedIn claimed canEdit={false} businessId="b1" profile={shop()} />);
  assert.match(stranger, /This website has been claimed by its owner\./);
  assert.doesNotMatch(stranger, /Edit my website|Text me the code|Open editor/);
  const owner = renderToStaticMarkup(<ClaimFlow token="t" signedIn claimed canEdit businessId="b1" profile={shop()} />);
  assert.match(owner, /Open editor/);
});

test('claiming is two numbered steps: email, then a code to the shop phone', () => {
  const out = renderToStaticMarkup(<ClaimSteps token="t" signedIn={false} phone="604-555-0142" name="Northline" />);
  assert.match(out, /Email me a sign-in link/);
  assert.match(out, /aria-current="true">Your email/);
  const signedIn = renderToStaticMarkup(<ClaimSteps token="t" signedIn phone="604-555-0142" name="Northline" />);
  assert.match(signedIn, /Text me the code/);
  assert.match(signedIn, /604-555-0142/);
});
