# NetCafe backend

This folder is the trusted API layer. It holds the Supabase secret key and performs approval/invitation actions that must never run in the browser.

## Setup

1. In Supabase Dashboard, open **SQL Editor** and run [`supabase/migrations/002_account_profiles.sql`](./supabase/migrations/002_account_profiles.sql), then [`supabase/migrations/003_user_codes.sql`](./supabase/migrations/003_user_codes.sql). This safely leaves the legacy `profiles` table unchanged and adds a unique NetCafe ID to every account.
2. Copy `.env.example` to `.env`.
3. In **Project Settings → API**, copy the **Secret key** (`sb_secret_...`) into `SUPABASE_SECRET_KEY`.
4. Run `npm install`, then `npm run dev` from this folder.
5. In Supabase **Authentication → URL Configuration**, add these Redirect URLs:
   - `http://localhost:3000/auth/set-password`
   - your production equivalent.

## Create the first administrator

Temporarily add `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (at least 12 characters) to `backend/.env`, then run `npm run bootstrap:admin`. This command only works on an empty `profiles` table; remove the temporary password afterward.

## Account approval flow

1. An authenticated staff member calls `POST /api/account-requests` with basic information and `role: "staff"` or `"customer"`.
2. The request is saved in `profiles` as `pending`; no Auth user/password exists yet.
3. An administrator calls `POST /api/admin/account-requests/:profileId/approve`.
4. The backend sends a Supabase Auth invitation. The recipient opens the email link and lands on `/auth/set-password`.
5. That page calls Supabase `updateUser({ password })`, then `POST /api/auth/activate-profile`; the profile becomes `active`.

## Main API endpoints

- `POST /api/account-requests` — staff/admin creates pending customer or staff profile.
- `GET /api/admin/account-requests` — admin lists pending requests.
- `POST /api/admin/account-requests/:profileId/approve` — admin approves and sends setup email.
- `POST /api/admin/account-requests/:profileId/reject` — admin rejects request.
- `POST /api/auth/activate-profile` — invited user activates profile after choosing password.

The frontend attaches the Supabase access token automatically through `frontend/lib/api.ts`.

## PC session transfers

Apply `supabase/migrations/012_station_session_transfers.sql` after migration 011
before using Transfer PC. The migration keeps history in
`station_sessions.transfer_history` and installs a service-role-only transactional
function. It also prevents duplicate open sessions across legacy PC name variants
such as `PC-01` and `PC-1`. If existing duplicates make that index fail, resolve
the conflicting open sessions before retrying; the migration rolls back as a unit.

Staff/admin calls `POST /api/station-sessions/:sessionId/transfer` with
`destinationStationId` and `expectedStationKey`. The original session, customer,
start time, hourly rate, and payment flow remain intact. A short database lock
serializes transfers with session writes; unavailable destinations, stale source
selections, and sessions already in checkout return a conflict.

Regression tests use an isolated PGlite PostgreSQL runtime, not your Supabase data.
For example, in PowerShell from `backend`:

```powershell
npm install --prefix "$env:TEMP/netcafe-transfer-validation" --no-save --package-lock=false @electric-sql/pglite
$env:PGLITE_MODULE = Join-Path $env:TEMP 'netcafe-transfer-validation/node_modules/@electric-sql/pglite'
node --test tests/station-transfers.test.cjs
```

Tests cover timer/rate preservation, audit history, same/occupied/stale targets,
all open session states, rollback on write failure, conflicting destination
requests, checkout, API authorization wiring, and request/error handling. PGlite
serializes queries; a multi-connection concurrency test against a staging
PostgreSQL instance is recommended before production rollout.

# Cancel PC billing

Apply `supabase/migrations/013_station_session_billing_pause.sql` before deploying
the billing cancellation update. `POST /api/station-sessions/:sessionId/cancel-checkout`
requires staff/admin access and `{ "checkoutAt": "<current checkout_at>" }`.
It resumes the existing session, clears the frozen checkout, and records excluded
billing time without changing the original start, customer, station or transfer history.
Run the regression coverage with `node --test tests/station-checkout.test.cjs`.

## Optional snacks in PC billing

Apply `supabase/migrations/014_station_session_snacks.sql` before collecting a PC
payment with snacks. Product data now lives in `src/snack-products.json`, shared
with the frontend's existing snack-menu export. The payment endpoint accepts
`snacks: [{ id, quantity }]`, validates prices against that catalog, and saves
item snapshots and the combined total on the same session payment. No separate
snack order or payment is created. PC-only payments still work before migration 014.
