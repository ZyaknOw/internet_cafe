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

## Local development

The existing two-terminal development workflow remains available:
`npm run dev --prefix backend` and `npm run dev --prefix frontend`.
Development frontend requests default to `http://localhost:4000`.

For a combined production run, provide the variables above in the process
environment, then run `npm run build` and `npm start` from the repository root.
The default local port is 3000. `npm test` builds the API and tests routing on a
single HTTP port without accessing Supabase.
