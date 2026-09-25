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
