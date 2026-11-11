# Hostinger PHP migration — Phase 2 implementation report

**Repository:** `ZyaknOw/internet_cafe`  
**Branch:** `hostinger-php-migration`  
**Scope:** PHP backend foundation only  
**Status:** Implemented and unit-tested; ready for review before Phase 3

## What was implemented

The isolated [php-app](../../php-app/README.md) now has a PHP 8.2+ front controller, URL router, JSON request/response types, environment configuration loader, centralized safe error handling, CSRF checks, exact-origin CORS policy, security headers, and Hostinger Apache rewrite rules. The bootstrap uses a small PSR-4 autoloader and has no runtime Composer dependency.

Supabase Auth and PostgREST are called from server-side PHP through the cURL transport. Requests use HTTPS, TLS certificate verification, bounded timeouts, fixed endpoints, and no redirect following. Modern `sb_secret_*` credentials are sent only in the `apikey` header; only legacy JWT-form service-role keys receive the compatibility bearer header. Browser code never receives either server credential or Supabase access/refresh tokens.

Authentication stores access and refresh tokens in a PHP-managed session with an HttpOnly, SameSite cookie, Secure in production, and session-ID rotation at login. Protected requests verify/refresh the access token with Supabase Auth and reload the profile using its Auth user ID. `pending` and `rejected` profiles cannot sign in. `active` and `approved` profiles can retrieve their linked profile, while the protected database health check requires an active admin. Role values from requests are never trusted.

The password setup endpoints update the current Auth user's password using that user's verified access token. The profile update is scoped to the same authenticated Auth user and can only transition an already `approved`/`active` profile to `active`; pending accounts cannot use it to bypass approval. No password, key, or token is logged or returned to the browser.

## Implemented endpoint inventory

| Endpoint | Access and response |
|---|---|
| `GET /health` | Public liveness, `{ "ok": true }`. |
| `GET /api/csrf` | Public; starts/uses a session and returns its CSRF token. |
| `POST /api/auth/login` | CSRF-protected Supabase password sign-in; returns profile, CSRF token, and password-change flag, but no auth tokens. |
| `POST /api/auth/logout` | CSRF-protected; revokes the Supabase session best-effort and always clears the local session. |
| `POST /api/auth/activate-profile` | Signed-in approved/active account; validates and changes password, then updates that account's activation flags. |
| `POST /api/auth/complete-password-change` | Alias for the password update flow. |
| `GET /api/me` | Signed-in active/approved profile, retaining the existing `{ "profile": ... }` envelope. |
| `GET /health/database` | Active admin only; read-only Supabase connectivity check using `account_profiles`. |

All other business endpoints intentionally remain unimplemented in this phase.

## Structure and setup

The implementation files are under `php-app/app/`, with `php-app/bootstrap.php` and `php-app/public_html/index.php` as bootstrap/front controller. `php-app/tests/run.php` contains a no-dependency test suite. `php-app/.env.example` contains placeholders only. [The README](../../php-app/README.md) documents local startup, required PHP extensions, config placement, security choices, and the Hostinger upload layout that keeps private PHP source and `.env` outside `public_html`.

Minimum runtime: PHP 8.2+ with `curl`, `json`, and `session`; `mbstring` is optional. Composer is optional because the application uses its own autoloader and no Composer runtime package.

## Verification performed

- PHP 8.3.36 CLI (`NTS`) was used from a temporary directory; it was not installed in the repository.
- `php -l` reported no syntax errors in all 24 PHP source/test files.
- `php tests/run.php`: **19 passed, 0 failed**. Coverage includes route parameters/404/405; health and profile response contracts; login/session token handling; pending-account denial; unauthenticated access; token refresh; admin/staff access control; CSRF; logout; CORS/preflight; production HTTPS/Secure-cookie configuration; password validation/update; and secret-key header placement.
- PHP built-in server smoke check through `public_html/router.php`: `GET /health` returned HTTP 200 with `{"ok":true}`.
- `composer.json` parsed as valid JSON.
- `git diff --check` passed.
- Tests use fake Supabase/session adapters; no network calls, live credentials, database writes, schema changes, or production data were used.

## Phase boundary and remaining review items

No files in `frontend/` or `backend/` were changed. No production Supabase schema or records were changed. Nothing was deployed. Billing, PC/session operations, registration, password-reset emails, dashboards, realtime, orders, account administration, and UI migration are not implemented and are not claimed complete.

Before broader API work, review the account status transition in the activation endpoint against the intended approval workflow and run integration tests against an isolated Supabase staging project with the exact Hostinger PHP extensions/config. The current implementation is unit-tested, but Supabase and Hostinger end-to-end connectivity have not been exercised. Phase 3 has not started.
