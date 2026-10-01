// Run after npm run build.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');
const { priceBillingSnacks } = require('../dist/billing-snacks.js');

test('catalog pricing rejects unknown, duplicate and invalid selections', () => {
  assert.deepEqual(priceBillingSnacks([]), []);
  assert.equal(priceBillingSnacks([{ id: 'sn-crackers', quantity: 2, price: 0 }])[0].price, 10);
  for (const items of [[{ id: 'missing', quantity: 1 }], [{ id: 'sn-crackers', quantity: 0 }],
    [{ id: 'sn-crackers', quantity: 1.5 }], [{ id: 'sn-crackers', quantity: 100 }],
    [{ id: 'sn-crackers', quantity: 1 }, { id: 'sn-crackers', quantity: 2 }]]) {
    assert.throws(() => priceBillingSnacks(items));
  }
});

function fixture({ migrated = true, balance = 200, loseRace = false } = {}) {
  const source = readFileSync(resolve(__dirname, '../src/server.ts'), 'utf8');
  const start = source.indexOf('app.post("/api/station-sessions/:stationKey/end"');
  const end = source.indexOf('// Top-up customer prepaid balance', start);
  let handler;
  const state = {
    session: { id: '10000000-0000-4000-8000-000000000001', status: 'awaiting_payment',
      station_key: 'PC-01', station_name: 'PC-01', customer_profile_id: 'customer',
      started_at: '2026-10-01T01:00:00Z', checkout_at: '2026-10-01T02:20:00Z',
      checkout_duration_seconds: 4800, checkout_total: 80, billing_paused_ms: 0, ended_at: null,
      ...(migrated ? { snack_items: [], snack_total: 0 } : {}) },
    customer: { id: 'customer', balance, total_spent: 0 }, station: { status: 'in_use' },
  };
  const schema = source.match(/const endStationSessionRequest = .*;/)[0];
  vm.runInNewContext(ts.transpileModule(schema + '\n' + source.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    z, priceBillingSnacks, Date, STATION_HOURLY_RATE: 60, logSupabaseError() {},
    requireActiveUser() {}, requireRole() {},
    app: { post(path, auth, role, cb) { handler = cb; } },
    supabaseAdmin: { from(table) {
      assert.ok(['station_sessions', 'account_profiles', 'stations'].includes(table), 'must not create a separate snack order');
      const key = { station_sessions: 'session', account_profiles: 'customer', stations: 'station' }[table];
      let update;
      const filters = [];
      const result = (single) => {
        if (table === 'station_sessions' && update && (loseRace || !filters.every(f => f(state.session)))) return { data: null, error: null };
        if (update) state[key] = { ...state[key], ...update };
        return { data: single ? { ...state[key] } : [{ ...state[key] }], error: null };
      };
      return { select() { return this; }, or() { return this; }, order() { return this; }, limit() { return this; },
        eq(k, v) { filters.push(r => r[k] === v); return this; },
        is(k, v) { filters.push(r => r[k] === v); return this; },
        in(k, values) { filters.push(r => values.includes(r[k])); return this; },
        update(value) { update = value; return this; },
        async maybeSingle() { return result(true); },
        then(resolve) { return Promise.resolve(result(false)).then(resolve); },
      };
    } },
  });
  return { state, async pay(body) {
    let status = 200, response;
    await handler({ params: { stationKey: state.session.id }, body }, {
      status(value) { status = value; return this; }, json(value) { response = value; return this; },
    });
    return { status, response };
  } };
}

test('cash and wallet combine PC and snacks in the same payment and retain frozen usage', async () => {
  for (const paymentMethod of ['cash', 'wallet']) {
    const { state, pay } = fixture();
    const result = await pay({ paymentMethod, cashReceived: 120, snacks: [{ id: 'sn-crackers', quantity: 2, price: 0 }] });
    assert.equal(result.status, 200);
    assert.equal(state.session.total, 100);
    assert.equal(state.session.snack_total, 20);
    assert.equal(state.session.snack_items[0].name, 'Crackers');
    assert.equal(state.session.checkout_duration_seconds, 4800);
    assert.equal(state.session.checkout_total, 80);
    assert.equal(state.session.ended_at, '2026-10-01T02:20:00.000Z');
    assert.equal(state.customer.balance, paymentMethod === 'cash' ? 200 : 100);
    assert.equal(state.customer.total_spent, 100);
    assert.equal(result.response.changeDue, paymentMethod === 'cash' ? 20 : 0);
  }
});

test('PC-only payment works without snack migration; failures retain checkout', async () => {
  const pcOnly = fixture({ migrated: false });
  assert.equal((await pcOnly.pay({ paymentMethod: 'cash', cashReceived: 80 })).status, 200);
  assert.equal(pcOnly.state.session.total, 80);
  for (const [options, body, expected] of [
    [{ migrated: false }, { paymentMethod: 'cash', cashReceived: 100 }, 503],
    [{ balance: 80 }, { paymentMethod: 'wallet' }, 400],
    [{}, { paymentMethod: 'cash', cashReceived: 80 }, 400],
    [{ loseRace: true }, { paymentMethod: 'cash', cashReceived: 100 }, 409],
  ]) {
    const f = fixture(options);
    assert.equal((await f.pay({ ...body, snacks: [{ id: 'sn-crackers', quantity: 2 }] })).status, expected);
    assert.equal(f.state.session.status, 'awaiting_payment');
    assert.equal(f.state.customer.total_spent, 0);
    assert.equal(f.state.station.status, 'in_use');
  }
});
