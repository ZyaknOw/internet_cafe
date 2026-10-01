const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');

test('cancel resumes the same session at the frozen second and permits another checkout', async () => {
  const source = readFileSync(resolve(__dirname, '../src/server.ts'), 'utf8');
  const start = source.indexOf('app.post("/api/station-sessions/:stationKey/checkout"');
  const end = source.indexOf('app.post("/api/station-sessions/:stationKey/end"', start);
  let now = Date.parse('2026-10-01T02:20:00Z');
  let row = { id: '10000000-0000-4000-8000-000000000001', status: 'active',
    started_at: '2026-10-01T01:00:00Z', billing_paused_ms: 0, hourly_rate: 60,
    customer_name: 'Customer', station_key: 'PC-01', transfer_history: [] };
  const original = { ...row };
  const handlers = {};
  let loseRace = false;
  const auth = () => {};
  vm.runInNewContext(ts.transpileModule(source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    app: { post(path, guard, roles, handler) { assert.equal(guard, auth); handlers[path.split('/').pop()] = handler; } },
    requireActiveUser: auth, requireRole(...roles) { assert.deepEqual(roles, ['admin', 'staff']); },
    z, checkoutStationSessionRequest: z.object({}), STATION_HOURLY_RATE: 60, logSupabaseError() {}, console,
    supabaseAdmin: { from(table) {
      assert.equal(table, 'station_sessions');
      let updates; const filters = [];
      return {
        select() { return this; }, order() { return this; }, limit() { return this; },
        eq(key, value) { filters.push(r => r[key] === value); return this; },
        in(key, values) { filters.push(r => values.includes(r[key])); return this; },
        update(value) { updates = value; return this; },
        async maybeSingle() {
          if (updates && loseRace) { loseRace = false; return { data: null }; }
          if (!filters.every(f => f(row))) return { data: null };
          if (updates) row = { ...row, ...updates };
          return { data: { ...row }, error: null };
        },
      };
    } },
  });
  const call = async (name, body = {}) => {
    let code = 200, result;
    await handlers[name]({ params: { sessionId: row.id, stationKey: row.id }, body }, {
      status(value) { code = value; return this; }, json(value) { result = value; return this; },
    });
    return { code, result };
  };
  await call('checkout');
  assert.equal(row.checkout_duration_seconds, 4800);
  const firstCheckout = row.checkout_at;
  now += 180000;
  assert.equal((await call('cancel-checkout', { checkoutAt: firstCheckout })).code, 200);
  assert.equal(row.status, 'active');
  assert.equal(now - Date.parse(row.started_at) - row.billing_paused_ms, 4800000);
  for (const key of ['id', 'started_at', 'customer_name', 'station_key', 'transfer_history']) assert.deepEqual(row[key], original[key]);
  for (const key of ['checkout_at', 'checkout_duration_seconds', 'checkout_total']) assert.equal(row[key], null);
  assert.equal((await call('cancel-checkout', { checkoutAt: firstCheckout })).code, 409);
  now += 60000;
  await call('checkout');
  assert.equal(row.checkout_duration_seconds, 4860);
  assert.equal(row.checkout_total, 81);
  assert.equal((await call('cancel-checkout', { checkoutAt: firstCheckout })).code, 409);
  loseRace = true;
  assert.equal((await call('cancel-checkout', { checkoutAt: row.checkout_at })).code, 409);
  now += 180000;
  await call('cancel-checkout', { checkoutAt: row.checkout_at });
  now += 60000;
  await call('checkout');
  assert.equal(row.checkout_duration_seconds, 4920);
  assert.equal(row.checkout_total, 82);
  row.status = 'ended';
  assert.equal((await call('cancel-checkout', { checkoutAt: row.checkout_at })).code, 409);
  delete row.billing_paused_ms;
  const missingMigration = await call('cancel-checkout', { checkoutAt: row.checkout_at });
  assert.equal(missingMigration.code, 503);
  assert.match(missingMigration.result.error, /013_station_session_billing_pause.sql/);
});
