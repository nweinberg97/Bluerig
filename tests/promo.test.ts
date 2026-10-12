import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, FORMATS, pageCount, promoContent, promoTopics, renderPromo, socialCaption, wrap } from '../src/lib/promo';
import { shop, NOW } from './fixtures';

test('the five categories the owner asked for', () => {
  assert.deepEqual(CATEGORIES.map((c) => c.label), ['Social media', 'Flyers', 'Business cards', 'Magnets', 'Yard signs']);
  for (const c of CATEGORIES) assert.ok(FORMATS.some((f) => f.category === c.id), c.id);
});

test('every format renders, in every look, with the real phone and name', () => {
  const p = shop({ special: { title: '$50 off furnace tune-ups', ends: '2026-11-30' } });
  for (const f of FORMATS) {
    for (let v = 0; v < 3; v++) {
      for (let i = 0; i < pageCount(f.id); i++) {
        const svg = renderPromo(p, f.id, { topic: 'special', variant: v, siteUrl: 'https://northline.bluerig.ca', slide: i, side: i as 0 | 1 });
        assert.match(svg, /^<svg /);
        assert.ok(svg.includes('604-555-0142') || svg.includes('NORTHLINE'), `${f.id} v${v} p${i}`);
        assert.ok(!svg.includes('undefined') && !svg.includes('NaN'), `${f.id} v${v} p${i} has bad values`);
      }
    }
  }
});

test('print files add 1/8 inch bleed', () => {
  const svg = renderPromo(shop(), 'card', { topic: 'brand', variant: 0, siteUrl: 'x.ca', print: true });
  assert.match(svg, /width="3.75in" height="2.25in"/);
});

test('topics come from the live site; expired deals are not offered', () => {
  const ids = promoTopics(shop({ special: { title: 'Old', ends: '2026-01-01' } }), NOW).map((t) => t.id);
  assert.ok(!ids.includes('special'));
  assert.ok(ids.includes('svc:s1'));
});

test('text is escaped and wrapped', () => {
  const p = shop();
  p.brand.name = 'A&B <Heating>';
  const svg = renderPromo(p, 'post', { topic: 'brand', variant: 1, siteUrl: 'x.ca' });
  assert.ok(svg.includes('A&amp;B &lt;HEATING&gt;') || svg.includes('A&amp;B &lt;Heating&gt;'));
  assert.ok(wrap('one two three four five six', 100, 20, 2).length <= 2);
});

test('caption has the phone and town hashtags', () => {
  const c = socialCaption(shop(), promoContent(shop(), 'brand'), 'https://northline.bluerig.ca');
  assert.match(c, /Call 604-555-0142 or send a request at northline\.bluerig\.ca/);
  assert.match(c, /#PortCoquitlam #Coquitlam/);
});
