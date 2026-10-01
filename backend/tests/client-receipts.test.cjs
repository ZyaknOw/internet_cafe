const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('client receipt feed scopes both sources to authenticated ownership and preserves saved prices', async () => {
  const source = readFileSync(require('node:path').resolve(__dirname, '../src/server.ts'), 'utf8');
  const start = source.indexOf('app.get(["/api/transactions"');
  const end = source.indexOf('// Front desk moves', start);
  let handler, guard;
  const auth = () => {};
  const records = {
    orders: ['alice', 'bob'].map(owner => ({ id: owner + '-order', customer_profile_id: owner, customer_name: owner,
      reference: owner + '-receipt', total: 37, items: [{ id: 'sn-crackers', name: 'Historical crackers', price: 37, quantity: 1 }], status: 'completed', payment_method: 'Cash' })),
    station_sessions: ['alice', 'bob'].map(owner => ({ id: owner + '-session', customer_profile_id: owner, customer_name: owner,
      status: 'ended', total: 82, checkout_total: 45, checkout_duration_seconds: 1200, snack_total: 37,
      snack_items: [{ id: 'sn-crackers', name: 'Historical crackers', price: 37, quantity: 1 }], cash_received: 100, change_due: 18 })),
  };
  vm.runInNewContext(ts.transpileModule(source.slice(start, end), {}).outputText, {
    app: { get(paths, authMiddleware, roleGuard, callback) { assert.equal(authMiddleware, auth); guard = roleGuard; handler = callback; } },
    requireActiveUser: auth,
    requireRole: () => (req, res, next) => req.profile.role === 'customer' ? res.status(403).json({}) : next(),
    isOrdersTableMissing: () => false,
    supabaseAdmin: { from(table) {
      let rows = records[table];
      return { select() { return this; }, eq(key, value) { rows = rows.filter(row => row[key] === value); return this; },
        order() { return this; }, async limit() { return { data: rows, error: null }; } };
    } },
  });
  for (const owner of ['alice', 'bob']) {
    let result;
    await handler({ path: '/api/client/transactions', profile: { id: owner }, query: { customer_profile_id: owner === 'alice' ? 'bob' : 'alice' } }, {
      json(value) { result = value; },
    });
    assert.equal(result.transactions.length, 2);
    assert.ok(result.transactions.every(row => row.customer === owner));
    const session = result.transactions.find(row => row.source === 'session');
    assert.equal(session.pcTotal, 45);
    assert.equal(session.amount, 82);
    assert.equal(session.snackItems[0].price, 37);
    assert.equal(session.changeDue, 18);
    assert.equal(session.durationSeconds, 1200);
  }
  for (const path of ['/api/transactions', '/api/admin/transactions']) {
    let status;
    guard({ path, profile: { role: 'customer' } }, { status(code) { status = code; return this; }, json() {} }, () => assert.fail('Client accessed staff feed'));
    assert.equal(status, 403);
  }
});
