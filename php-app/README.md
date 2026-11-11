# Internet Cafe PHP foundation

This isolated Phase 2 application adds a PHP 8.2+ front controller and a small JSON API for Hostinger PHP/HTML hosting. It does not replace or edit `frontend/` or `backend/`, and it does not migrate PC sessions, billing, reports, or other business endpoints. Supabase remains the identity provider and database.

## Local setup

1. Install PHP 8.2 or newer with the `curl`, `json`, and `session` extensions enabled. `mbstring` is optional; input validation falls back to byte length when it is absent.
2. Copy `.env.example` to `.env` in this project directory. Use a Supabase development/staging project for manual API work. Do not put real keys in Git.
3. Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `APP_ALLOWED_ORIGINS`, and the app URL. For local HTTP, keep `SESSION_COOKIE_SECURE=false`; production must use HTTPS and set it to `true`.
4. Start the PHP development server from this directory:

   ```sh
   php -S 127.0.0.1:8080 -t public_html public_html/router.php
   ```

5. Open `GET /health`. For login, first call `GET /api/csrf`, retain the PHP session cookie, then send the returned token as `X-CSRF-Token` on `POST /api/auth/login`. Tokens are stored in the PHP session and are not returned to browser code.

The `.env` loader does not overwrite process/hosting environment variables. `APP_CONFIG_PATH` can point to a private config file outside the document root. Do not put that file beneath `public_html`.

## Runtime and Composer

No runtime Composer library is required. The Supabase adapter uses PHP cURL with TLS verification and fixed Auth/PostgREST paths. `composer.json` declares PHP/extensions, PSR-4 metadata, and the test command; the checked-in bootstrap includes a dependency-free PSR-4 loader, so Composer is optional on Hostinger. If Composer is available locally, run `composer test`; otherwise run `php tests/run.php`.

Required extensions: `curl`, `json`, `session`. Verify these in Hostinger hPanel before upload. PHP 8.2 is the minimum; use a newer supported 8.x version when available.

## Implemented endpoints

| Method and path | Access | Behavior |
|---|---|---|
| `GET /health` | Public | App liveness; returns `{ "ok": true }`. |
| `GET /api/csrf` | Public | Creates/returns a session-bound CSRF token. |
| `POST /api/auth/login` | Public + CSRF | Supabase password sign-in, profile link/status/role check, session ID rotation, token persistence in the server session. |
| `POST /api/auth/logout` | Session + CSRF | Best-effort Supabase logout then local session invalidation. |
| `POST /api/auth/activate-profile` | Approved/active user + CSRF | Sets the signed-in Auth user's password and activates their own approved profile. |
| `POST /api/auth/complete-password-change` | Approved/active user + CSRF | Alias for the password setup/update flow. |
| `GET /api/me` | Active or approved user | Reloads and returns the linked profile using `{ "profile": ... }`. |
| `GET /health/database` | Active admin | Read-only connectivity check against `account_profiles`. |

Every protected request verifies the Supabase access token with Auth and looks up the profile by `auth_user_id`; browser-supplied roles/status are ignored. `pending` and `rejected` accounts cannot log in. Only `admin` can reach the database check. No route accepts arbitrary table names or SQL. Phase 2 does not implement business writes other than the authenticated user's password and own profile activation fields.

## Security and deployment layout

- Keep the app source and private config one directory above the public document root. For the usual Hostinger layout, place `bootstrap.php`, `app/`, `config/`, `vendor/` (if later added), and the private `.env` under the domain directory; place the contents of this project's `public_html/` under the domain's actual `public_html/`. The entry point's `../bootstrap.php` reference then resolves outside the web root. If Hostinger allows changing the document root, point it directly to this project's `public_html/` and keep the project root private beside it.
- `.htaccess` disables directory listings and rewrites missing paths to `index.php`; existing static files are served directly. `router.php` is only for PHP's local development server.
- Keep `.env` outside `public_html`; set file permissions so only the hosting account can read it. Prefer Hostinger's private environment settings when available.
- Set `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_COOKIE_SECURE=true`, and `SESSION_COOKIE_SAMESITE=Lax` behind HTTPS. Set `APP_ALLOWED_ORIGINS` to exact origins only, with no wildcard. This same-origin app should normally allow only its own HTTPS origin.
- Supabase publishable and secret keys are attached server-side as `apikey` headers. A user access token is sent only to Supabase Auth for user verification/update/logout. Modern `sb_secret_*` keys are not copied into `Authorization`; the legacy JWT service-role format receives the bearer header needed by legacy Supabase projects. Never place the secret key in HTML, JS, or API responses.
- Responses use generic errors, security/cache headers, and no-store. cURL verifies TLS, does not follow redirects, and has bounded timeouts. Logs omit credentials and upstream response bodies.
- CORS permits only configured origins and credentials, and preflight headers/methods are allowlisted. State-changing API calls require `X-CSRF-Token`.

## Tests

Tests use in-memory session and Supabase fakes; they do not make network calls or write to any Supabase project. Run `php tests/run.php` (or `composer test`) from `php-app/` after installing PHP. The suite covers route matching/404/405, liveness and profile response contracts, CSRF, sign-in/status enforcement, token verification, role restrictions, CORS, password activation, and Supabase secret-key header placement.

## Current boundary

This is a backend foundation, not the migrated website. No admin/staff/customer UI, registration flow, password reset email flow, rate limiting, realtime subscriptions, PC/station/session operations, billing, receipts, orders, or account administration have been ported. Do not cut over or deploy until staging integration and role workflow tests are completed in later phases.
