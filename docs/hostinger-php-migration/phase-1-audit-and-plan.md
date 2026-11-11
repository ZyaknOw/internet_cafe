# Hostinger PHP migration — Phase 1 audit and plan

**Repository:** `ZyaknOw/internet_cafe`  
**Branch:** `hostinger-php-migration`  
**Audit scope:** current `main` snapshot at commit `3628c41`  
**Phase:** audit and migration foundation only

This is a plan, not a PHP implementation. No production Supabase data, schema, keys, or settings were changed. The existing `frontend/` and `backend/` directories were not modified.

## 1. Current architecture

- `frontend/` is a Next.js App Router application using React 19 and TypeScript. The landing, sign-in, signup, customer, staff, and admin screens are client-rendered React pages/components, with a large shared stylesheet in `frontend/app/globals.css` and portal-specific stylesheets.
- `backend/` is an Express 5 + TypeScript JSON API. It uses the Supabase JavaScript SDK with a server-side `SUPABASE_SECRET_KEY`; it authenticates bearer tokens with Supabase Auth and performs privileged PostgREST/Auth Admin calls.
- Supabase supplies PostgreSQL tables, Auth, PostgREST, Realtime, and the atomic PC-transfer RPC. Existing business data remains in Supabase for the proposed PHP migration.
- The proposed PHP app will be same-origin with its HTML/JS UI and API routes, so browser requests can use secure same-site session cookies instead of sending a server secret to JavaScript.
- Existing migrations describe `account_profiles`, `station_sessions`, `orders`, `stations` (pre-existing), plus session billing/transfer columns and transfer RPC. The migration files are documentation and are not to be rerun or edited during this phase.

### Dependency audit

- Frontend runtime/build: Next.js, React, React DOM, `@supabase/ssr`, `@supabase/supabase-js`, `react-hook-form`, Zod, Tailwind CSS 4, Base UI, Lucide icons, `clsx`, `class-variance-authority`, and `tailwind-merge`. These do not become PHP runtime requirements. Their UI/form/routing/auth responsibilities need HTML/CSS/vanilla-JS replacements.
- Backend runtime: Express, CORS, Zod, Supabase JS SDK, `ws`, and dotenv. TypeScript/tsx and type packages are build/dev-only. The PHP path needs PHP 8.2+, `curl`, JSON, and sessions; no MySQL driver is needed if Supabase remains the database.
- `backend/src/bootstrap-admin.ts` and `repair-admin.ts` are operational account setup/repair scripts, not HTTP routes. A PHP migration needs a safe, documented initial-admin provisioning procedure; never expose either operation as public registration.

## 2. Features to preserve by role

### Admin

- Sign in/out, Supabase session restoration, pending/rejected-account handling, forced first-password change, forgot-password flow, and account/profile/password modals.
- Dashboard overview: daily revenue, active sessions, registered accounts, PC availability, pending account approvals, and notification modal.
- PC management: add a PC, reactivate a preserved disabled PC, edit its display label/specs/type, and maintain rates (standard ₱100/hour and VIP ₱150/hour). PC numbers are unique; an open PC session prevents edits/reactivation.
- PC-session revenue reports by daily, monthly, or yearly Manila calendar range; custom date/month selection, customer/PC search, totals, hours, and completed-session records.
- Transactions/receipts, customer directory, staff/admin directory, account registration, approval/rejection, temporary-password display, profile editing, and account deletion safeguards.
- Realtime refreshes for station sessions, profiles, stations, and legacy orders.

### Staff

- Sign in/out and self profile/password management.
- Operations overview and live workstation board: station availability, active/waiting/checkout state, customer assignment, elapsed timer, and allowed station transfer.
- Billing flow: freeze checkout amount/time, return to the live session by cancelling checkout (excluding that pause from billable time), accept cash or customer wallet, validate cash received, compute change, deduct wallet / update spend, end session, and show payment success/receipt details.
- Customer lookup/list, account registration request, and wallet top-up.
- Receipt/transaction history and live refreshes.
- **Legacy café-order queue endpoints and UI are still present in this snapshot.** Client `POST /api/client/orders` is explicitly disabled with HTTP 410, even though some client order UI remains. This conflicts with the earlier product direction to make the service computer-only. Recommended migration scope: omit snack purchasing and order creation from new PHP UI; preserve existing historical rows as read-only receipts only if the owner wants old records retained. Confirm before implementing that decision.

### Customer

- Public registration and pending approval messaging; Supabase email/password login, forgot password, first-login password change, logout, and session recovery.
- Profile data and avatar field management, account details, wallet balance, user code, and own activity/receipt history.
- Customer-only station availability board with an own-session indicator, live updates, and session status/timer details. Staff/customer views must not disclose another member's identity to customers.
- Client session sign-in fallback using NetCafe ID + registered contact and an assigned station.
- Existing snack/coffee/pre-order interface is inconsistent with the disabled create-order API and computer-only requirement; do not silently re-enable it in PHP.

### Shared business behavior

- Roles are `admin`, `staff`, `customer`; profile states include `pending`, `approved`, `active`, `rejected`.
- Station identity accepts legacy spellings (for example `PC-01`/`PC-1`) and optional display suffixes. Visible inventory defaults to the original first eight but can include higher PCs after admin enables them.
- Session states include `pending_client`, `active`, `awaiting_payment`, `ended`, and `cancelled`. A PC can have at most one open session.
- Billing uses server/database timestamps, the captured session hourly rate, frozen checkout seconds/amount, and `billing_paused_ms`; transferred sessions keep the original customer, start time, rate, and payment flow.
- Session payment is cash or wallet, with cash received/change stored. The system updates customer wallet and total-spent values.
- Admin revenue reports use Manila calendar boundaries; the PHP replacement must not use the Hostinger server's local timezone implicitly.

## 3. Express route inventory and proposed PHP equivalents

“Active user” means a valid Supabase Auth user linked to an `account_profiles` row with `status = active`, unless the notes identify a different check. All routes are currently JSON endpoints. Proposed PHP endpoints keep the paths for an easier UI cutover; dynamic parts are handled by the PHP front controller.

| Existing Express route | Current access | PHP controller/action | Purpose / preservation notes |
|---|---|---|---|
| `GET /health` | Public | `HealthController::app` | App liveness |
| `GET /health/database` | Public | `HealthController::database` | Supabase connectivity check |
| `GET /api/me` | Signed-in profile | `AuthController::me` | Load linked account profile |
| `PATCH /api/me/profile` | Active user | `ProfileController::updateMine` | Validate unique identity/contact fields and update profile |
| `PATCH /api/admin/users/:id/profile` | Admin | `AdminUsersController::updateProfile` | Edit another account profile |
| `DELETE /api/admin/users/:id` | Admin | `AdminUsersController::delete` | Delete profile/sessions/Auth user; preserve self-delete guard and review current best-effort Auth delete behavior |
| `POST /api/station-sessions` | Admin/staff | `SessionsController::assign` | Assign customer and start metered session immediately |
| `GET /api/station-sessions/open` | Admin/staff | `SessionsController::open` | Open-session queue |
| `POST /api/client/session-sign-in` | Public, ID + contact | `ClientSessionsController::signInByCode` | Finds customer's pending/active session; currently a low-assurance lookup, see security risks |
| `GET /api/public/stations` | Public | `StationsController::publicList` | Public PC availability and rates |
| `POST /api/admin/stations` | Admin | `AdminStationsController::createOrEnable` | Add/reactivate PC; enforce 1–99 number, uniqueness, type rates |
| `PATCH /api/admin/stations/:id` | Admin | `AdminStationsController::update` | Rename/spec/type update; must keep PC number and prevent editing while open |
| `GET /api/stations` | Admin/staff | `StationsController::staffList` | Control-board stations + customer/session details |
| `GET /api/client/stations` | Any active profile in API | `StationsController::clientList` | Client availability board + `mine`; audit role check should be tightened to customer in migration |
| `POST /api/station-sessions/:sessionId/transfer` | Admin/staff | `SessionsController::transfer` | Call existing `transfer_station_session` RPC; atomic availability/history/timer/rate behavior is critical |
| `POST /api/station-sessions/:stationKey/checkout` | Admin/staff | `BillingController::beginCheckout` | Freeze seconds and total before payment |
| `POST /api/station-sessions/:sessionId/cancel-checkout` | Admin/staff | `BillingController::cancelCheckout` | Resume session with billable pause excluded; compare checkout timestamp to avoid stale writes |
| `POST /api/station-sessions/:stationKey/end` | Admin/staff | `BillingController::settleSession` | Cash/wallet validation, idempotent session close, wallet/total-spent updates, receipt details |
| `POST /api/customers/:id/top-up` | Admin/staff | `WalletController::topUp` | Add prepaid balance |
| `POST /api/client/orders` | Active user | `OrdersController::create` (disabled) | Always returns 410; no new snack order should be created |
| `POST /api/staff/orders/:id/settle` | Admin/staff | `OrdersController::settleLegacy` | Legacy cash settlement of old café tickets |
| `GET /api/client/orders` | Active user | `OrdersController::listMine` | Own legacy order history; preserve/read-only only if historical data is retained |
| `GET /api/staff/orders` | Admin/staff | `OrdersController::staffQueue` | Legacy ticket queue |
| `GET /api/admin/reports` | Admin | `ReportsController::pcRevenue` | Daily/monthly/yearly PC session revenue in Manila time |
| `GET /api/transactions` | Admin/staff | `TransactionsController::listAll` | Shared staff/admin receipt feed |
| `GET /api/admin/transactions` | Admin/staff | `TransactionsController::listAll` | Alias of shared receipt feed |
| `GET /api/client/transactions` | Active user | `TransactionsController::listMine` | Receipts filtered server-side by authenticated profile |
| `PATCH /api/staff/orders/:id/status` | Admin/staff | `OrdersController::updateLegacyStatus` | Legacy order queue state changes |
| `GET /api/client/sessions/:id/status` | Active user | `ClientSessionsController::status` | Own session status only |
| `POST /api/account-requests` | Admin/staff | `AccountRequestsController::create` | Create pending staff/customer request; duplicate checks |
| `GET /api/customers` | Admin/staff | `CustomersController::index` | Customer list, balances, profile data |
| `GET /api/staff` | Admin | `AdminUsersController::staffIndex` | Staff/admin directory |
| `GET /api/admin/account-requests` | Admin | `AccountRequestsController::pending` | Pending registrations |
| `POST /api/admin/account-requests/:profileId/approve` | Admin | `AccountRequestsController::approve` | Create/update Supabase Auth user, set temp password and force reset, show temporary password once |
| `POST /api/admin/account-requests/:profileId/reject` | Admin | `AccountRequestsController::reject` | Reject request |
| `POST /api/auth/complete-password-change` | Signed-in profile | `AuthController::completePasswordChange` | Clear force-change flag in profile and Auth metadata |
| `GET /api/admin/overview` | Admin | `DashboardController::adminOverview` | Revenue, accounts, sessions, PC count, requests/order count |
| `GET /api/staff/overview` | Admin/staff | `DashboardController::staffOverview` | Operations-only counters |
| `POST /api/public/register` | Public | `RegistrationController::register` | Customer registration; create pending profile, duplicate checks |
| `POST /api/auth/activate-profile` | **No matching Express route found** | `AuthController::activateProfile` only if desired/confirmed | The invitation/password page calls this path, but the current Express route inventory does not define it. Verify expected behavior during Phase 2; do not invent a behavior that can bypass approval. |

The list above is based on route declarations in `backend/src/server.ts`; authorization middleware is in `backend/src/auth.ts`. Error response shape/status codes and validation constraints also need a compatibility matrix before replacing the API.

## 4. React-to-PHP UI migration map

| Current frontend | PHP/HTML/JS migration approach |
|---|---|
| `app/page.tsx`, `components/ether/*` | `public/index.php` + `views/landing.php`; preserve current landing layout, auth modal, signup link, and visual CSS; hydrate only small interactive behavior with vanilla JS. |
| `app/signup/page.tsx`, `app/auth/set-password/page.tsx` | `views/auth/signup.php`, `views/auth/set-password.php`; browser form validation + same-origin JSON endpoints; keep Supabase email/reset links pointed at the PHP pages. |
| `components/ether/auth-modal.tsx`, `lib/auth-context.tsx`, Supabase client | `AuthController`, secure PHP session, `assets/js/auth.js`; preserve login errors, state checks, forced password change, recovery, and logout. |
| `app/admin/dashboard/page.tsx`, `components/admin-portal/*` | `views/admin/dashboard.php`, admin partials and `assets/js/admin-dashboard.js`; keep Overview, account queue/notifications, PC Stations, PC reports, transaction receipts, profile/account modals. |
| `app/staff/dashboard/page.tsx`, `components/staff-portal/*` | `views/staff/dashboard.php`, staff partials and `assets/js/staff-dashboard.js`; keep live PC board, assignments/transfers, billing/checkout, wallets/top-up, customer/account actions, receipts. Omit new snack-ordering UI per computer-only direction. |
| `app/client/dashboard/page.tsx`, `components/client-portal/*` | `views/customer/dashboard.php`, sidebar/header/summary partials and `assets/js/customer-dashboard.js`; keep stations, own active session, transactions/receipts, account/profile. Remove snack ordering; preserve old records only under the decision recorded above. |
| `components/shared/user-profile-modal.tsx`, `receipt-details-modal.tsx` | Shared PHP partials rendered server-side and modal behavior in vanilla JS; preserve role-based fields/actions and receipt detail formats. |
| `app/globals.css`, portal CSS | Move/adapt current CSS into `public/assets/css/`; first preserve current class names/layout, then remove React/Tailwind-specific utilities and dead styles in later phases. |
| `lucide-react`, `next/font`, Next Image/route behavior | Replace icons with inline SVG/CSS or small local assets; use local/system font fallback or locally hosted fonts; replace Next routing/image optimization with PHP routes and ordinary responsive images. |

The visual rewrite can retain much of the existing CSS and copy its markup structure, but React state, hooks, JSX conditionals, browser-to-API calls, modals, form state, Realtime listeners, and Next navigation must be rebuilt. This is a substantial UI rewrite, not a transpile/export step.

## 5. Proposed shared-hosting project structure

Phase 1 creates only the empty tree under `php-app/`; no endpoint is implemented. On Hostinger, keep application code/config outside the public document root when the account layout permits, and expose only `public_html/` (or point the domain document root to the contained `public_html/`).

```text
php-app/
├── composer.json
├── .env.example
├── .gitignore
├── README.md
├── app/
│   ├── Bootstrap.php
│   ├── Controllers/
│   ├── Middleware/
│   ├── Services/
│   │   └── Supabase/
│   ├── Support/
│   └── Validation/
├── config/
├── routes/
│   ├── web.php
│   └── api.php
├── storage/
│   └── logs/
├── views/
│   ├── layouts/
│   ├── partials/
│   ├── auth/
│   ├── admin/
│   ├── staff/
│   └── customer/
└── public_html/
    ├── .htaccess
    ├── index.php
    └── assets/
        ├── css/
        ├── js/
        ├── images/
        └── icons/
```

`index.php`, route registration, Supabase client, and controllers are intentionally absent in this audit scaffold. The later implementation should add a single front controller with allowlisted routes, not a generic request-to-Supabase proxy. A tracked placeholder can be added only when Phase 2 begins.

## 6. Supabase integration and secret handling plan

- Keep the existing Supabase project, PostgreSQL data, Auth users, Storage (if used), and RPC; do not migrate this data to Hostinger MySQL/phpMyAdmin.
- Supabase's official PHP client is not a safe production foundation at the time of this audit: the `supabase-community/supabase-php` repository labels itself alpha and says its APIs may change. Prefer a small, tested PHP `curl` HTTP client around the documented Supabase Auth and PostgREST APIs until a stable supported PHP SDK is established. [Supabase PHP community client status](https://github.com/supabase-community/supabase-php)
- Server-side config should include `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. Load through Hostinger environment settings or a private config file outside `public_html`; keep real values out of Git. The publishable key is a browser-safe project identifier; the secret key is privileged and must never enter HTML, JS, public config, logs, or source control. Supabase states secret keys bypass RLS and must stay in trusted backend components. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- PHP should call the documented Supabase Data REST API at `/rest/v1/` with `curl`, timeouts, TLS verification, URL-encoded filter values, JSON encoding, explicit response/error handling, and per-route allowlisted table/field operations. Do not implement an open proxy accepting arbitrary table names, filters, or SQL from the browser. [Supabase Data REST API](https://supabase.com/docs/guides/api)
- For Auth: use the public password sign-in/refresh/recovery endpoints as applicable, validate user access tokens against Supabase Auth server-side, and reserve Auth Admin operations (create/update/delete users) for admin-authorized PHP actions using the secret key. Do not trust role/status values from browser input or decode a JWT without validating it.
- Supabase Auth is an HTTP service that issues and refreshes JWTs; a PHP client/session layer can be built around its HTTP API, but the current JavaScript SDK's persistence/refresh behavior must be replaced deliberately. [Supabase Auth architecture](https://supabase.com/docs/guides/auth/architecture)
- Recommended browser session: PHP-managed server-side session storing Supabase access/refresh tokens; cookie flags `Secure`, `HttpOnly`, `SameSite=Lax` (or stricter where flows permit), session ID rotation after login, CSRF token for state-changing same-origin form/API requests, logout invalidates local and Supabase session as required. Never store the secret key in the session cookie or localStorage.
- Every PHP request must reload the linked account profile and enforce `role` plus `status` server-side. Since the current Express API uses a privileged secret key for most reads/writes, RLS cannot be treated as the only authorization boundary.
- The transfer route must invoke the current `transfer_station_session` RPC; reimplementing it as multiple REST updates loses database transaction/locking guarantees. Add integration coverage against an isolated staging Supabase project before cutover.

## 7. Risks and significant rewrites

1. **Supabase PHP SDK maturity:** community PHP client is alpha; direct REST wrapper and maintained tests add work.
2. **Auth/session rewrite:** browser Supabase SDK currently owns tokens and session restoration. PHP sessions, reset links, Auth Admin actions, and forced password changes need careful reimplementation.
3. **Token validation:** current server uses `auth.getUser(token)`; PHP must make an equivalent trusted Auth request or correctly validate rotating Supabase signing keys. Do not assume a JWT algorithm/key is fixed.
4. **Privileged service key:** current Express backend uses a secret key that bypasses RLS. Any missing PHP role/profile check could expose or mutate all records.
5. **Financial concurrency/idempotency:** checkout, cancel checkout, wallet settlement/top-up, and transfer must retain stale-state guards and atomic constraints. A race or replay can misbill or double-charge.
6. **Timer/timezone:** preserve UTC timestamps, paused milliseconds, frozen seconds/amount, Manila report boundaries, and server time semantics. Test around midnight and DST-independent +08:00 calendar boundaries.
7. **Realtime:** current dashboards subscribe to Supabase Postgres Changes for `station_sessions`, `account_profiles`, `stations`, and `orders`. PHP pages can still use browser Realtime with only the publishable key and the required publication/RLS setup; otherwise explicitly choose polling and test freshness/load. Never send the secret key to establish a browser subscription.
8. **Session sign-in by code/contact:** currently unauthenticated and has no visible rate-limit/CAPTCHA guard. Add throttling, generic error responses, and abuse monitoring before exposing it publicly.
9. **Registration and temporary passwords:** public registration has no visible rate limiter; approval returns a temporary password once. Current temporary-password generation uses `Math.random`, which is not cryptographically secure. Replace with a cryptographically secure generator; ensure the value is not logged, is shown only to admin once, and first sign-in requires reset.
10. **Current implementation inconsistencies:** `/api/auth/activate-profile` is called from the set-password page but has no Express route. Customer `/api/client/stations` requires an active profile but does not itself require the customer role. Snack UI exists while order creation returns HTTP 410. These require explicit behavior decisions/fixes in a later implementation phase.
11. **Avatar storage:** profile UI supports an avatar URL, but no Supabase Storage upload implementation was found in the audited source. Determine whether photos are external URL only, stored elsewhere, or unfinished before promising upload parity.
12. **Hostinger shared-host limits:** verify available PHP version/extensions, Composer/vendor deployment, `curl`, TLS CA bundle, PHP session configuration, document-root control, upload sizes, and HTTPS. PHP request/response is compatible with shared hosting; long-lived Node processes are not needed. Realtime sockets from browsers remain a separate external Supabase connection.
13. **Legacy orders/snacks:** existing `orders` endpoints and receipt formatting still exist. The computer-only decision should govern new UI and writes; historical financial rows should not be deleted during migration.
14. **Status/role inconsistencies:** the React login accepts both `active` and `approved` profiles, while most protected Express routes require `active`; the customer station-list endpoint checks active status but not the customer role. Define one intended status transition and role matrix, then enforce it consistently in PHP.
15. **Realtime authorization:** the repository enables RLS on `station_sessions` and `orders` but does not include explicit row policies for them; verify actual publication/RLS configuration before retaining browser Postgres Changes subscriptions. The browser must use only a publishable key.

## 8. Phased migration and test checklist

### Phase 1 — Audit/foundation (current)

- [x] Confirm branch and clean starting tree.
- [x] Inventory roles, main screens, API routes, Supabase data/Auth usage, migrations, realtime listeners, dependencies, and known mismatches.
- [x] Create a separate empty PHP structure and `.env.example`; no existing app files or live Supabase changed.
- [x] Record architecture, compatibility/security risks, and phased acceptance checklist.

### Phase 2 — PHP runtime and Supabase HTTP foundation

- [ ] Verify Hostinger PHP version/extensions/HTTPS/document root and private config placement.
- [ ] Add front controller, route registry, secure error handling, request validation, CSRF/session middleware, and a typed/allowlisted Supabase HTTP client.
- [ ] Implement Auth/session lifecycle and role/status guards before business endpoints.
- [ ] Unit-test URL encoding, JSON/errors/timeouts, cookie/session flags, CSRF rejection, invalid/expired tokens, and role/status denial.
- [ ] Integration-test against isolated staging Supabase accounts/data only; do not point test writes at production.

### Phase 3 — Read-only UI/API parity

- [ ] Port landing/sign-in/signup/password pages and customer/admin/staff dashboards with current styles.
- [ ] Implement health, profile, station availability, customer/staff lists, overview, transactions, and PC revenue reports.
- [ ] Compare old/new screens at desktop and mobile breakpoints; verify role-specific data hiding.
- [ ] Test report period boundaries and search/pagination/empty/error/loading states.

### Phase 4 — Account and PC administration

- [ ] Implement signup request, duplicate checks, approval/rejection, one-time temporary credential display, password reset/change, profile edits, safe deletion, PC add/edit/reactivate.
- [ ] Test admin-only endpoints with customer/staff sessions and verify 401/403 behavior.
- [ ] Test disabled PC rows, numbers 1–99, duplicate/variant names, active-PC edit guards, approval replay, and password recovery redirect.

### Phase 5 — Session timing, transfer, and billing

- [ ] Port assignment, open sessions, client session sign-in/status, transfer via RPC, frozen checkout, cancellation/pause, cash/wallet settlement, top-up, and receipts.
- [ ] Test transfer into occupied/self/stale destination; timer/rate/customer preservation; concurrent transfer/assignment; checkout/payment replay; insufficient wallet; exact cash/change; cancelled pending session; and paused-time exclusion.
- [ ] Compare PHP amounts/receipts against seeded expected calculations and original behavior.

### Phase 6 — Realtime, cutover, and acceptance

- [ ] Decide browser Supabase Realtime vs polling; test changes from multiple staff/customer sessions and reconnect behavior.
- [ ] Run security review: no secret in output/network/browser bundle, CSRF/session fixation, rate limits, authorization matrix, input injection, logging/PII, and secure headers.
- [ ] Run end-to-end role workflows on a staging project with representative seeded records, not production.
- [ ] Obtain explicit owner approval for cutover; take verified backups/export, document rollback, deploy only after go/no-go approval, and perform smoke tests.

## 9. Phase 1 completion boundary

This audit does not claim PHP features are implemented. It does not change the production Supabase database, perform deployment, copy real credentials, or modify the existing `frontend/` or `backend/`. Phase 2 should begin only after the audit decisions above—especially legacy snack history and the missing activation route—are accepted.
