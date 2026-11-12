const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { z } = require('zod');
const { previousReportRange, reportAnalytics } = require('../dist/report-analytics.js');
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
const { requireRole } = require('../dist/auth.js');
const source = fs.readFileSync(path.join(__dirname, '../src/server.ts'), 'utf8');
const rangeSource = source.slice(source.indexOf('function manilaReportRange('), source.indexOf('function logSupabaseError('));
const reportSchema = source.slice(source.indexOf('const adminReportQuery = '), source.indexOf('function manilaReportRange('));
const apiSource = source.slice(source.indexOf('const activityQuery = '), source.indexOf('// Shared receipt feed'));

function fixture(records) {
  const routes = {};
  const queries = [];
  const auth = () => {};
  const compiled = ts.transpileModule(rangeSource + reportSchema + apiSource, {}).outputText;
  vm.runInNewContext(compiled, {
    z, Date, console, previousReportRange, reportAnalytics, requireActiveUser: auth, requireRole,
    app: { get(route, authentication, roleGuard, handler) {
      assert.equal(authentication, auth); routes[route] = { roleGuard, handler };
    } },
    supabaseAdmin: { from(table) {
      let filtered = records[table] || [];
      const query = { table };
      queries.push(query);
      return {
        select(fields) { query.fields = fields; return this; },
        order() { return this; }, not() { return this; },
        eq(key, value) { filtered = filtered.filter(row => row[key] === value); return this; },
        gte(key, value) { filtered = filtered.filter(row => row[key] >= value); return this; },
        lt(key, value) { filtered = filtered.filter(row => row[key] < value); return this; },
        lte(key, value) { filtered = filtered.filter(row => row[key] <= value); return this; },
        async range(start, end) { query.range = [start, end]; return { data: filtered.slice(start, end + 1), count: filtered.length, error: null }; },
      };
    } },
  });
  return { routes, queries };
}
const response = () => ({ code: 200, body: null,
  status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('history and analytics endpoints reject customers and staff at the admin guard', () => {
  const { routes } = fixture({});
  for (const route of Object.values(routes)) {
    for (const role of ['customer', 'staff']) {
      const res = response(); route.roleGuard({ profile: { role } }, res, () => assert.fail('Unauthorized role passed'));
      assert.equal(res.code, 403);
    }
    let passed = false;
    route.roleGuard({ profile: { role: 'admin' } }, response(), () => { passed = true; });
    assert.equal(passed, true);
  }
});

test('history validates Manila date filters and paginates the selected action without private profile fields', async () => {
  const events = Array.from({ length: 32 }, (_, id) => ({ id, action: 'account.approved', occurred_at: '2026-11-11T16:00:00.000Z' }));
  const { routes, queries } = fixture({ account_activity_log: events });
  const res = response();
  await routes['/api/admin/activity'].handler({ query: { from: '2026-11-12', to: '2026-11-12', action: 'account.approved', page: '2' } }, res);
  assert.equal(res.code, 200); assert.equal(res.body.events.length, 7); assert.equal(res.body.total, 32);
  assert.equal(queries[0].range[0], 25);
  assert.ok(!queries[0].fields.includes('*'));
  for (const query of [{ from: '2026-02-30' }, { from: '2026-11-12', to: '2026-11-01' }, { page: '0' }]) {
    const invalid = response(); await routes['/api/admin/activity'].handler({ query }, invalid); assert.equal(invalid.code, 400);
  }
});

test('the report API keeps prior-period rows out of the selected ledger and uses saved checkout revenue', async () => {
  const { routes } = fixture({ station_sessions: [
    { id: 'prior', status: 'ended', ended_at: '2026-01-13T18:00:00.000Z', checkout_total: 40, total: 40, checkout_duration_seconds: 1440 },
    { id: 'selected', status: 'ended', ended_at: '2026-01-14T18:00:00.000Z', checkout_total: 60, total: 999, checkout_duration_seconds: 1800 },
    { id: 'not-ended', status: 'active', ended_at: '2026-01-14T19:00:00.000Z', total: 999 },
  ] });
  const res = response();
  await routes['/api/admin/reports'].handler({ query: { period: 'daily', date: '2026-01-15' } }, res);
  assert.equal(res.body.transactions.length, 1);
  assert.equal(res.body.summary.totalRevenue, 60);
  assert.equal(res.body.summary.totalHours, 0.5);
  assert.equal(res.body.analytics.previous.revenue, 40);
  assert.equal(res.body.analytics.comparison.revenueChangePercent, 50);
});
