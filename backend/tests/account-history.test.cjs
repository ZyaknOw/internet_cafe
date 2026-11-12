const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const adminId = '10000000-0000-4000-8000-000000000001';
const clientId = '10000000-0000-4000-8000-000000000002';
const rejectedId = '10000000-0000-4000-8000-000000000003';
const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/018_account_activity_history.sql'), 'utf8');

test('account audit captures successful actions atomically, preserves deletion history and protects private data', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.account_profiles (
      id uuid primary key, first_name text, last_name text, role text, status text,
      created_by_profile_id uuid references account_profiles(id),
      approved_by_profile_id uuid references account_profiles(id), approved_at timestamptz,
      must_change_password boolean default false, contact text, updated_at timestamptz default now()
    );
    grant all on public.account_profiles to service_role;
    insert into public.account_profiles(id,first_name,last_name,role,status,approved_at)
      values ('${adminId}','Test','Administrator','admin','active','2026-01-01T00:00:00Z');`);
  await db.exec(migration);
  assert.equal((await db.query('select count(*)::int as count from account_activity_log')).rows[0].count, 1);
  await db.exec(`set role service_role;
    insert into account_profiles(id,first_name,last_name,role,status,contact)
      values ('${clientId}','New','Client','customer','pending','private-contact');
    update account_profiles set status='active', must_change_password=true,
      approved_by_profile_id='${adminId}',last_modified_by_profile_id='${adminId}',approved_at=now()
      where id='${clientId}';
    update account_profiles set first_name='Updated',last_modified_by_profile_id='${adminId}' where id='${clientId}';
    update account_profiles set must_change_password=false,last_modified_by_profile_id='${clientId}' where id='${clientId}';
    insert into account_profiles(id,first_name,last_name,role,status,created_by_profile_id)
      values ('${rejectedId}','Declined','Client','customer','pending','${adminId}');
    update account_profiles set status='rejected',last_modified_by_profile_id='${adminId}' where id='${rejectedId}';
    delete from account_profiles where id='${rejectedId}'; reset role;`);
  const { rows } = await db.query('select * from account_activity_log order by occurred_at,id');
  for (const action of ['account.created','account.approved','account.updated','account.deleted','account.rejected','account.password_setup_completed']) {
    assert.ok(rows.some(row => row.action === action), `Missing ${action}`);
  }
  const approved = rows.find(row => row.action === 'account.approved' && row.target_profile_id === clientId);
  assert.equal(approved.actor_name, 'Test Administrator');
  assert.equal(approved.details.previous_status, 'pending');
  assert.equal(rows.find(row => row.action === 'account.deleted').actor_profile_id, adminId);
  assert.ok(!JSON.stringify(rows).includes('private-contact'));
  await db.exec('begin;');
  await db.exec(`update account_profiles set first_name='RolledBack' where id='${clientId}'; rollback;`);
  assert.equal((await db.query('select count(*)::int as count from account_activity_log')).rows[0].count, rows.length);
  await db.exec(migration);
  assert.equal((await db.query('select count(*)::int as count from account_activity_log')).rows[0].count, rows.length);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from public.account_activity_log'), /permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  await assert.rejects(db.query('delete from public.account_activity_log'), /permission denied/);
  await db.exec('reset role');
});
