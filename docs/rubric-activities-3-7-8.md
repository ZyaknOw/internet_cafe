# Presentation guide: activities 3, 7 and 8

## Deployment

Run `backend/supabase/migrations/018_account_activity_history.sql` in Supabase SQL
Editor before deploying the new API. The migration is transactional and can be
rerun. It adds an account actor reference, a protected history table, and an
account-change trigger. It does not change passwords or PC billing amounts.

Redeploy the latest `main` with the existing combined Express/root `server.js`
settings. No new environment variables or Node.js processes are needed.

## Activity 3: account management and administrator history

Open **Admin → Account History**. Demonstrate a real account creation, approval
or rejection using the existing confirmation dialog. Refresh history to show:

- The person who performed the action, their role, and the affected account.
- The action and Philippine timestamp.
- Changed field names and account status transitions. Private values and
  passwords are not stored in the log.
- Action/date filters, 25-row pagination and automatic 15-second refresh.

Profile changes, account deletion and completion of required password setup are
also captured. Account deletion retains the name snapshot in history. Updates
to balance alone are not account-management history events. This is not a log
of every Supabase login or every subsequent password change.

The database trigger writes the event in the same transaction as the profile
change. A rolled-back change produces no successful event. The server supplies
the actor ID from verified authentication, rather than accepting an actor from
browser input. Public/authenticated database roles cannot read the table, and
the service role has SELECT only; the trigger performs inserts. The history API
additionally requires an active administrator.

Earlier approvals are imported only from existing `approved_at` and approver
records. Edits/rejections that were never recorded cannot be reconstructed.

## Activity 7: customer status and assigned personnel

Have a staff member assign a customer to a PC. Compare the staff board and the
customer's **Overview → Live Workstation** card:

- Same PC, session state and assigning personnel name.
- Account status, real elapsed time and customer-side last-sync timestamp.
- The customer sees only their own assigning personnel; other customers' names
  and billing snapshots are not exposed through the customer station API.
- Realtime station/session events refresh the card; a 15-second fallback poll
  covers missing event delivery. Failed refreshes are labeled as stale.
- Checkout becomes **Awaiting payment**, and the saved bill/timer stays frozen.
  After staff completes payment, the customer becomes unassigned/idle.

“Assigned by” is the staff/admin who originally created the session, linked by
`station_sessions.created_by_profile_id`. PC transfers retain that session and
its original assigning person. If the original person was not recorded or was
deleted, show **Not recorded**, not an invented staff name. No separate staff
reassignment feature is claimed.

## Activity 8: statistical and graphical reporting

Open **Admin → Reports** and choose a Philippine day, month or year that has
completed paid PC sessions. Demonstrate:

- Revenue bar chart and completed-session line chart: hourly, daily or monthly
  buckets depending on the selected period, including real zero intervals.
- Revenue, paid session count, billed hours and average paid-session value.
- Peak revenue/busiest intervals and comparison with the previous calendar
  period. An unfinished current period is explicitly labeled; a zero previous
  baseline has no percentage growth claim.
- Expandable exact chart data and CSV download of the selected session ledger.
- Next-period projection, calculated as mean revenue per completed interval
  multiplied by the number of intervals in the next calendar period.

Only completed intervals enter the projection; future/incomplete intervals are
not treated as observations. At least three completed intervals and three paid
sessions are required. Otherwise the screen says **Insufficient historical
data**. This is a simple run-rate estimate, not a statistical guarantee or a
seasonality-aware forecasting model. Reports explicitly exclude snacks and
wallet top-ups, and use saved PC checkout amounts where available.

## Verification commands

Backend compilation: `npm run build --prefix backend`.

API/math tests (from `backend`):

```powershell
node --test tests/report-analytics.test.cjs tests/rubric-api.test.cjs tests/client-stations.test.cjs
```

Audit migration validation uses an isolated PGlite database, not Supabase:

```powershell
npm install --prefix "$env:TEMP/netcafe-rubric-validation" --no-save --package-lock=false @electric-sql/pglite
$env:PGLITE_MODULE = Join-Path $env:TEMP 'netcafe-rubric-validation/node_modules/@electric-sql/pglite'
node --test tests/account-history.test.cjs
```

Frontend tests (from `frontend`): `node --test tests/report-render.test.cjs
tests/client-session-usage.test.cjs`. Local chart layout preview (from repository
root): `node scripts/preview-rubric.cjs`, then open `http://127.0.0.1:4318`.
The preview uses synthetic fixtures and does not query or seed production data.
