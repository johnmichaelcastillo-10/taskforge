# Deploying Taskforge (Vercel and Turso)

The app runs on **Vercel**, as serverless functions plus static files, built from the GitHub
repository. Its database is **Turso**, a hosted libSQL (SQLite) service. Serverless instances
have no lasting disk, so a local SQLite file can't be used there; the build refuses to deploy
without a Turso URL.

Both have free plans that fit this app. Turso's free plan (checked October 2026) gives:
- 100 databases and 5 GB of storage;
- 500 million rows read and 10 million rows written a month;
- no card required.

## 1. Create the Turso database

With the Turso CLI (or the same steps in the Turso dashboard):

```bash
turso db create taskforge
turso db show taskforge --url        # libsql://taskforge-<you>.turso.io
turso db tokens create taskforge     # the auth token
```

Keep both values for step 3. The token is a secret.

For preview deployments, create a second database, such as `taskforge-preview`, with its own
token. Previews then never touch production data.

## 2. Import the repository into Vercel

1. In Vercel, choose **Add New → Project** and import the GitHub repository.
2. Vercel detects Nuxt. `vercel.json` sets the build command to
   `node scripts/migrate.mjs && npm run build`, so every deployment applies pending migrations
   to its database before building.

## 3. Set the environment variables

In **Project → Settings → Environment Variables**:

| Variable | Value | Environments |
|---|---|---|
| `NUXT_DATABASE_URL` | `libsql://taskforge-<you>.turso.io` | Production (the preview database's URL for Preview) |
| `NUXT_DATABASE_AUTH_TOKEN` | The token from step 1 | Same as above |
| `NUXT_SESSION_PASSWORD` | 64 random hex characters (below) | All |
| `NUXT_TRUST_PROXY` | `true` | All |
| `NUXT_PUBLIC_REGISTRATION_ENABLED` | `false` (the default; demo accounts only) | Optional |
| `NUXT_DEMO_TTL_HOURS` | `72` (the default) | Optional |

Make the variables available at **build** time as well as at runtime: the build runs the
migrations.

To generate a session password, in Bash:

```bash
openssl rand -hex 32
```

or in PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
-join ($bytes | ForEach-Object { $_.ToString('x2') })
```

What each setting is for:
- **`NUXT_TRUST_PROXY=true`:** Vercel sets `X-Forwarded-For` to the visitor's address, so the
  rate limits count per visitor. Without it, every visitor shares one count.
- **`NUXT_SESSION_PASSWORD`:** changing it signs everyone out.

## 4. Deploy and check

Deploy from the Vercel dashboard, or push to the main branch. Then check:

1. `https://<your-app>.vercel.app/api/health` returns `{"status":"ok","checks":{"database":"ok"}}`.
2. **Try the demo** opens a seeded workspace.
3. The response headers include `content-security-policy` and `strict-transport-security`.
4. A request to `/api/v1/me` without a token returns 401.

## Migrations and rollbacks

- **When:** migrations run on every deployment. Migrations already applied are skipped, so this
  is safe.
- **Making a migration:** generate it locally with
  `docker compose run --rm dev npm run db:generate`, commit it, and deploy.
- **Rolling back:** Vercel's **Instant Rollback** restores the previous app, but not the
  database. Keep migrations additive (new tables or columns, not renames or drops), so an
  older version of the app still works with the newer schema.
- **Restoring data:** Turso's free plan includes one day of point-in-time restore.

## Expired demos

There's no scheduled job. Expired demo accounts, with all their data, and old rate-limit rows
are deleted whenever a new demo starts. An expired demo can't sign in, even before its rows are
deleted.

## Troubleshooting

- **The build fails with "NUXT_DATABASE_URL must be a Turso URL":** the variable is missing,
  isn't available at build time, or still points to a local file.
- **`/api/health` returns 503:** the database URL or token is wrong, or the token has expired.
  The function logs on Vercel show the error.
- **Everyone gets "Too many attempts":** set `NUXT_TRUST_PROXY=true`.
- **Everyone was signed out:** `NUXT_SESSION_PASSWORD` changed.

## What has and hasn't been tested

- **Tested locally:** the Vercel build (`NITRO_PRESET=vercel`), with its function run behind a
  local HTTP server. It served the health check, demo sign-up, pages with the CSP, static
  assets, and the API's 401.
- **Not yet run:** a live deployment, and the app against a real Turso database. This network
  blocks `*.vercel.app`, and the libSQL server image couldn't be pulled for a local stand-in. The
  app uses Turso's documented client (`@libsql/client` with a `libsql://` URL and auth token).
  After the first deployment, run the checks in step 4.
