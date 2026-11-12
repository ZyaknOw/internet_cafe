const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../lib/client-session-usage.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
new Function('exports', compiled)(mod.exports);
const { clientSessionUsage } = mod.exports;
const start = '2026-11-12T00:00:00.000Z';
const now = Date.parse(start) + 30 * 60_000;
const assigned = { mine: true, startedAt: start, sessionStatus: 'active', rate: 100 };

test('approval or login without an assigned session never accrues time or a total', () => {
  for (const time of [now, now + 24 * 60 * 60_000]) {
    assert.deepEqual(clientSessionUsage(null, time), { seconds: 0, total: 0, rate: 0 });
    assert.equal(clientSessionUsage({ ...assigned, mine: false }, time).seconds, 0);
    assert.equal(clientSessionUsage({ ...assigned, sessionStatus: 'pending_client' }, time).total, 0);
    assert.equal(clientSessionUsage({ ...assigned, startedAt: undefined }, time).total, 0);
  }
});

test('elapsed time comes from the saved start, survives refresh, and uses the saved session rate', () => {
  const station = { ...assigned, rate: 150, sessionRate: 100 };
  assert.deepEqual(clientSessionUsage(station, now), { seconds: 1800, total: 50, rate: 100 });
  assert.deepEqual(clientSessionUsage({ ...station }, now + 60_000), { seconds: 1860, total: 51.67, rate: 100 });
});

test('cancelled checkout pauses are excluded and transfers preserve the original clock', () => {
  const station = { ...assigned, billingPausedMs: 5 * 60_000 };
  assert.deepEqual(clientSessionUsage(station, now), { seconds: 1500, total: 41.67, rate: 100 });
  assert.equal(clientSessionUsage(station, now + 60_000).seconds, 1560);
});

test('checkout freezes the saved duration and total until payment', () => {
  const station = { ...assigned, sessionStatus: 'awaiting_payment', checkoutDurationSeconds: 1200, checkoutTotal: 33.33 };
  for (const time of [now, now + 60 * 60_000]) {
    assert.deepEqual(clientSessionUsage(station, time), { seconds: 1200, total: 33.33, rate: 100 });
  }
});

test('invalid timestamps and future starts cannot display fabricated usage', () => {
  assert.equal(clientSessionUsage({ ...assigned, startedAt: 'Waiting for client' }, now).seconds, 0);
  assert.equal(clientSessionUsage({ ...assigned, startedAt: 'bad date' }, now).total, 0);
  assert.equal(clientSessionUsage(assigned, Date.parse(start) - 1000).seconds, 0);
});
