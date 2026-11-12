const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('client board includes the owners saved billing snapshot without exposing another clients snapshot', async () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/server.ts'), 'utf8');
  const start = source.indexOf('app.get("/api/client/stations"');
  const end = source.indexOf('// Move the existing session', start);
  let handler;
  const records = {
    stations: [1, 2, 3].map(id => ({ id, name: `PC-${id}`, hourly_rate: 150 })),
    station_sessions: [
      { station_key: 'PC-01', station_name: 'PC-1', customer_profile_id: 'owner', status: 'awaiting_payment',
        started_at: '2026-11-12T00:00:00Z', hourly_rate: 100, billing_paused_ms: 5000,
        checkout_duration_seconds: 1200, checkout_total: 33.33 },
      { station_key: 'PC-02', station_name: 'PC-2', customer_profile_id: 'other', status: 'active',
        started_at: '2026-11-12T00:00:00Z', hourly_rate: 90, billing_paused_ms: 0 },
    ],
  };
  const auth = () => {};
  vm.runInNewContext(ts.transpileModule(source.slice(start, end), {}).outputText, {
    app: { get(_route, guard, callback) { assert.equal(guard, auth); handler = callback; } },
    requireActiveUser: auth, isVisibleCafeStation: () => true,
    stationIdentity: value => value, console,
    supabaseAdmin: { from(table) {
      const result = Promise.resolve({ data: records[table], error: null });
      return { select() { return this; }, order() { return result; }, in() { return result; } };
    } },
  });
  let body;
  const res = { json(value) { body = value; }, status(code) { assert.fail(`Unexpected HTTP ${code}`); } };
  await handler({ profile: { id: 'owner' } }, res);
  const [mine, other, idle] = body.stations;
  assert.equal(mine.mine, true);
  assert.equal(mine.startedAt, '2026-11-12T00:00:00.000Z');
  assert.equal(mine.sessionRate, 100);
  assert.equal(mine.billingPausedMs, 5000);
  assert.equal(mine.checkoutDurationSeconds, 1200);
  assert.equal(mine.checkoutTotal, 33.33);
  for (const station of [other, idle]) {
    assert.equal(station.mine, false);
    assert.equal(station.sessionRate, undefined);
    assert.equal(station.billingPausedMs, undefined);
    assert.equal(station.checkoutTotal, undefined);
  }
  await handler({ profile: { id: 'newly-approved-client' } }, res);
  assert.equal(body.stations.some(station => station.mine), false);
  assert.equal(body.stations.some(station => station.checkoutTotal !== undefined), false);
});
