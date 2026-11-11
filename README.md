# Internet Cafe: one deployment

The repository root starts one Node.js process serving both the Next.js website
and the Express API on the same domain and port. `/api/*` and `/health*` go to
Express; page and static asset requests go to Next.js.

## Hostinger settings

Change the existing Web App's settings; no second website is needed:

| Setting | Value |
| --- | --- |
| Repository branch | `main` |
| Framework preset | Express (custom Node.js entry point) |
| Root directory | `.` (repository root, not `frontend`) |
| Node version | 22.x |
| Package manager | npm |
| Build command | `npm run build` (script `build`) |
| Entry file | `server.js` |
| Output directory, if shown | `.` (whole app, not `.next` or `dist`) |

The root build installs both apps from their committed lockfiles, compiles
`backend/dist`, and builds `frontend/.next` with Webpack. Keep both directories,
their dependencies, and `server.js` in the deployment. Never upload `.env` files.
The root `postinstall` script runs this build automatically during `npm install`,
including in Hostinger's Express preset when no build-command field is shown.

Set these environment variables in Hostinger before building:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR-SERVER-SECRET-KEY
FRONTEND_URL=https://internetcafe.bscs4a.com
NODE_ENV=production
```

Use the same Supabase project for browser and server values. The secret key is
server-only and must never have a `NEXT_PUBLIC_` prefix. Do not set `PORT`;
Hostinger supplies it. Remove `NEXT_PUBLIC_API_URL` from this combined deployment
so production requests use the current website's origin. Rebuild after changing
any `NEXT_PUBLIC_` values because Next.js embeds them during the build.

After deployment, `/health` should return `{"ok":true}`. Browser requests should
use `https://internetcafe.bscs4a.com/api/...`, never `localhost:4000`.

The listener opens before API/Next.js initialization. `/health/live` returns 200
as soon as Node.js can accept requests. `/health/ready` returns 200 only when
both apps are ready; pages return a short 503 response while starting. Startup
logs show `entry-loaded`, `listening`, `loading-api`, `preparing-next`, and `ready`.
A failure or a 60-second initialization timeout logs the blocked stage and exits
with code 1 so the hosting runner can restart the app. Root `.env` loading uses
the entry file location rather than the hosting runner's working directory.

The runtime does not spawn Next.js as a child process or use a process manager.
It defaults the libuv thread pool to 2 unless the platform already sets a value.
If the hosting account is at its process/thread limit, free capacity through
Hostinger Resource Usage or ask support to clear stale app processes before
restarting. This can affect other websites sharing the same hosting plan.

## Local development

The existing two-terminal development workflow remains available:
`npm run dev --prefix backend` and `npm run dev --prefix frontend`.
Development frontend requests default to `http://localhost:4000`.

For a combined production run, provide the variables above in the process
environment, then run `npm run build` and `npm start` from the repository root.
The default local port is 3000. `npm test` builds the API and tests routing on a
single HTTP port without accessing Supabase.
After a successful build, `npm run test:production` verifies actual direct and
hosting-loader startup from an unrelated working directory, with fake database
configuration and no authenticated database requests.
