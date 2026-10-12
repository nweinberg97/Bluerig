import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayOf, hoursOn, localDate, nextDate, pruneExpired, todayLine, untilFromPreset, isAvailabilityLive } from '../src/lib/time';
import { shop, NOW } from './fixtures';

test('local date uses the shop timezone, not UTC', () => {
  assert.equal(localDate(NOW, 'America/Vancouver'), '2026-10-11');
  assert.equal(localDate(NOW, 'America/Toronto'), '2026-10-11');
  assert.equal(localDate(NOW, 'UTC'), '2026-10-12');
});

test('weekday and date math', () => {
  assert.equal(dayOf('2026-10-11'), 'Sun');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('holiday override wins over regular hours', () => {
  const p = shop({ overrides: [{ id: 'o', from: '2026-12-24', to: '2026-12-26', closed: true }] });
  assert.equal(hoursOn(p, '2026-12-24'), null); // Thursday, normally open
  assert.deepEqual(hoursOn(p, '2026-12-23'), [8, 17]);
});

test('today line on a Sunday points to Monday', () => {
  const t = todayLine(shop(), NOW);
  assert.equal(t.open, false);
  assert.match(t.text, /opens tomorrow at 8am/);
});

test('expired deals, holidays and statuses fall off', () => {
  const p = shop({
    special: { title: 'Old deal', ends: '2026-10-10' },
    overrides: [{ id: 'a', from: '2026-10-01', to: '2026-10-02', closed: true }, { id: 'b', from: '2026-12-25', to: '2026-12-25', closed: true }],
    availability: { kind: 'emergency', until: '2026-10-12T02:00:00Z' },
  });
  const q = pruneExpired(p, NOW);
  assert.equal(q.special, null);
  assert.deepEqual(q.overrides.map((o) => o.id), ['b']);
  assert.equal(q.availability.kind, 'normal');
});

test('a deal is live through its last day', () => {
  const q = pruneExpired(shop({ special: { title: 'Tune-up', ends: '2026-10-11' } }), NOW);
  assert.ok(q.special);
});

test('emergency presets always end', () => {
  const tz = 'America/Vancouver';
  const tonight = new Date(untilFromPreset('tonight', NOW, tz));
  assert.equal(localDate(tonight, tz), '2026-10-11');
  assert.ok(tonight > NOW);
  const morning = untilFromPreset('morning', NOW, tz);
  assert.equal(morning, '2026-10-12T14:00:00.000Z'); // 7am PDT
  const p = shop({ availability: { kind: 'emergency', until: morning } });
  assert.ok(isAvailabilityLive(p, NOW));
  assert.ok(!isAvailabilityLive(p, new Date('2026-10-12T15:00:00Z')));
});

test('typed dates roll to next year when passed', () => {
  assert.equal(nextDate('dec', 24, NOW, 'America/Vancouver'), '2026-12-24');
  assert.equal(nextDate('Jan', '2', NOW, 'America/Vancouver'), '2027-01-02');
  assert.equal(nextDate('feb', 30, NOW, 'America/Vancouver'), null);
});
