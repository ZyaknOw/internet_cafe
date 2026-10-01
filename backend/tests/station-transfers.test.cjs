// Run against an isolated PostgreSQL runtime, never the application database.
// PGLITE_MODULE can point to a temporary installation of @electric-sql/pglite.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');

test('transfers preserve billing and enforce availability atomically', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table account_profiles (id uuid primary key);
      create table stations (id uuid primary key, name text not null, status text not null);
    `);
    for (const name of ['004_station_sessions.sql', '010_station_session_checkout_state.sql', '012_station_session_transfers.sql']) {
      await db.exec(readFileSync(resolve(__dirname, '../supabase/migrations', name), 'utf8'));
    }
    const actor = '10000000-0000-4000-8000-000000000001';
    const customer = '10000000-0000-4000-8000-000000000002';
    const pc = (n) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    await db.query('insert into account_profiles values ($1), ($2)', [actor, customer]);
    for (let n = 1; n <= 6; n++) {
      await db.query('insert into stations values ($1, $2, $3)', [pc(n), `PC-0${n}`, n === 1 ? 'in_use' : 'available']);
    }
    const inserted = await db.query(`insert into station_sessions
      (station_key, station_name, customer_profile_id, customer_name, hourly_rate, status, started_at)
      values ('PC-01', 'PC-01 - Standard Gaming', $1, 'Test customer', 50, 'active', now() - interval '37 minutes') returning to_jsonb(station_sessions) as session`, [customer]);
    const original = inserted.rows[0].session;
    const transfer = (id, destination, expected) => db.query(
      'select transfer_station_session($1, $2, $3, $4) as session', [id, destination, expected, actor],
    );
    const moved = (await transfer(original.id, pc(2), 'PC-01')).rows[0].session;
    for (const key of ['id', 'customer_profile_id', 'customer_name', 'hourly_rate', 'status', 'started_at', 'requested_at', 'checkout_at', 'checkout_total', 'total']) {
      assert.equal(String(moved[key]), String(original[key]), `${key} must survive transfer`);
    }
    assert.equal(moved.station_key, 'PC-02');
    assert.equal(moved.transfer_history.length, 1);
    assert.equal(moved.transfer_history[0].staff_profile_id, actor);
    assert.equal(moved.transfer_history[0].from_station_key, 'PC-01');
    assert.ok(moved.transfer_history[0].transferred_at);
    assert.deepEqual((await db.query('select status from stations where id in ($1, $2) order by name', [pc(1), pc(2)])).rows.map(r => r.status), ['available', 'in_use']);
    await assert.rejects(transfer(original.id, pc(2), 'PC-02'), /different PC/);
    await assert.rejects(transfer(original.id, pc(3), 'PC-01'), /has moved/);
    await assert.rejects(transfer(original.id, pc(99), 'PC-02'), /not found/);
    await db.query("update stations set status = 'maintenance' where id = $1", [pc(6)]);
    await assert.rejects(transfer(original.id, pc(6), 'PC-02'), /not available/);

    // Each open state reserves the destination, including frozen checkout.
    for (const status of ['pending_client', 'active', 'awaiting_payment']) {
      const occupied = await db.query(`insert into station_sessions
        (station_key, station_name, customer_profile_id, customer_name, hourly_rate, status)
        values ('PC-3', 'PC-03 - Standard Gaming', $1, 'Other customer', 50, $2) returning id`, [customer, status]);
      await assert.rejects(transfer(original.id, pc(3), 'PC-02'), /no longer available/);
      await db.query('delete from station_sessions where id = $1', [occupied.rows[0].id]);
    }
    // Ordinary assignments cannot bypass occupancy by spelling PC-02 as PC-2.
    await assert.rejects(db.query(`insert into station_sessions
      (station_key, station_name, customer_profile_id, customer_name, hourly_rate, status)
      values ('pc-2', 'PC-2', $1, 'Other customer', 50, 'active')`, [customer]), /unique/);
    assert.equal((await db.query('select transfer_history from station_sessions where id = $1', [original.id])).rows[0].transfer_history.length, 1);

    // The database enforces a single winner when two moves target one PC.
    const second = (await db.query(`insert into station_sessions
      (station_key, station_name, customer_profile_id, customer_name, hourly_rate, status, started_at)
      values ('PC-04', 'PC-04', $1, 'Other customer', 40, 'active', now()) returning id`, [customer])).rows[0];
    const outcomes = await Promise.allSettled([
      transfer(original.id, pc(5), 'PC-02'), transfer(second.id, pc(5), 'PC-04'),
    ]);
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(r => r.status === 'rejected').length, 1);

    // Force the final session write to fail: neither station flag may leak out.
    await db.exec(`create function reject_test_transfer() returns trigger language plpgsql as $$
      begin raise exception 'test write failure'; end; $$;
      create trigger reject_test_transfer before update on station_sessions
      for each row execute function reject_test_transfer();`);
    const beforeFailure = (await db.query('select * from stations order by name')).rows;
    const location = (await db.query('select station_key from station_sessions where id = $1', [original.id])).rows[0].station_key;
    await assert.rejects(transfer(original.id, pc(1), location), /test write failure/);
    assert.deepEqual((await db.query('select * from stations order by name')).rows, beforeFailure);
    await db.exec('drop trigger reject_test_transfer on station_sessions');

    // Checkout still freezes the same elapsed time/rate and rejects later moves.
    await db.query(`update station_sessions set status = 'awaiting_payment', checkout_at = now(),
      checkout_duration_seconds = floor(extract(epoch from now() - started_at)),
      checkout_total = round((extract(epoch from now() - started_at) / 3600 * hourly_rate)::numeric, 2)
      where id = $1`, [original.id]);
    const checkout = (await db.query('select * from station_sessions where id = $1', [original.id])).rows[0];
    assert.ok(checkout.checkout_duration_seconds >= 37 * 60);
    assert.ok(Number(checkout.checkout_total) >= 30.83);
    await assert.rejects(transfer(original.id, pc(1), checkout.station_key), /Only an active/);
    assert.equal((await db.query('select count(*)::integer as count from station_sessions')).rows[0].count, 2);
    assert.equal((await db.query("select has_function_privilege('authenticated', 'transfer_station_session(uuid,text,text,uuid)', 'execute') as allowed")).rows[0].allowed, false);
  } finally {
    await db.close();
  }
});

test('transfer API uses staff authorization, validates input and sanitizes failures', async () => {
  const vm = require('node:vm');
  const ts = require('typescript');
  const { z } = require('zod');
  const server = readFileSync(resolve(__dirname, '../src/server.ts'), 'utf8');
  const start = server.indexOf('app.post("/api/station-sessions/:sessionId/transfer"');
  const end = server.indexOf('app.post("/api/station-sessions/:stationKey/checkout"', start);
  let handler, roles, rpcArgs, destinationName = 'PC-02', result = { data: { id: 'same-session' }, error: null };
  const auth = () => {};
  const roleGuard = () => {};
  vm.runInNewContext(ts.transpileModule(server.slice(start, end), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    app: { post(path, authMiddleware, roleMiddleware, callback) {
      assert.equal(path, '/api/station-sessions/:sessionId/transfer');
      assert.equal(authMiddleware, auth);
      assert.equal(roleMiddleware, roleGuard);
      handler = callback;
    } },
    requireActiveUser: auth,
    requireRole: (...allowed) => { roles = allowed; return roleGuard; },
    z, logSupabaseError() {},
    isCafeStation: vm.runInNewContext(ts.transpileModule(server.slice(server.indexOf('const MAX_STATIONS'), server.indexOf('const accountRequest')) + '\nisCafeStation;', {}).outputText),
    supabaseAdmin: {
      from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: { name: destinationName }, error: null }; } }; },
      async rpc(name, args) { assert.equal(name, 'transfer_station_session'); rpcArgs = args; return result; } },
  });
  assert.deepEqual(roles, ['admin', 'staff']);
  const req = {
    params: { sessionId: '30000000-0000-4000-8000-000000000001' },
    body: { destinationStationId: 'pc-id', expectedStationKey: 'PC-01', actorId: 'spoofed' },
    profile: { id: 'authenticated-staff' },
  };
  let status, body;
  const res = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
  await handler(req, res);
  assert.equal(body.session.id, 'same-session');
  assert.equal(rpcArgs.p_actor_id, 'authenticated-staff');
  assert.deepEqual(Object.keys(rpcArgs).sort(), ['p_actor_id', 'p_destination_id', 'p_expected_station', 'p_session_id']);
  await handler({ ...req, body: {} }, res);
  assert.equal(status, 400);
  for (const name of ['PC-09', 'PC-20']) {
    destinationName = name;
    rpcArgs = null;
    await handler(req, res);
    assert.equal(status, 400);
    assert.equal(rpcArgs, null);
  }
  destinationName = 'PC-08';
  for (const [code, expected] of [['P0001', 409], ['P0002', 404], ['23505', 409], ['PGRST202', 503], ['XX000', 500]]) {
    result = { data: null, error: { code, message: 'database-detail' } };
    await handler(req, res);
    assert.equal(status, expected);
    if (code === 'PGRST202') assert.match(body.error, /012_station_session_transfers.sql/);
    if (code === 'XX000') assert.ok(!body.error.includes('database-detail'));
  }
});
