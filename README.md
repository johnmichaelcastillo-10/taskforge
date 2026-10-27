# Taskforge

Project management and time tracking for developers: projects, a Kanban board, work-session
timers and productivity analytics.

> **Status: in development.** The foundation is in place: Nuxt, SQLite with migrations, Docker,
> a health check and CI. Features arrive phase by phase; see [docs/SPEC.md](docs/SPEC.md).

## Stack

- **Framework:** Nuxt 4 (Vue 3, TypeScript), with server routes for the backend.
- **UI:** Nuxt UI 4 and Tailwind CSS 4.
- **Database:** SQLite through libSQL, with Drizzle ORM and SQL migrations. It is a local file
  in development and Docker, and Turso in production.
- **Tests and CI:** Vitest, ESLint, vue-tsc, GitHub Actions.
- **Containers:** Docker with Compose; Node 24.

## Requirements

Only Docker. Node, npm and SQLite all run inside containers.

- **Windows 10/11:** Docker Desktop with the WSL 2 backend.
- **Linux:** Docker Engine with the Compose plugin.

## Quick start

From the repository folder:

**PowerShell (Windows)**

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

**Bash (Linux, macOS or WSL)**

```bash
cp .env.example .env
docker compose up --build -d
```

Open <http://localhost:8094>. The page shows **Database: connected** when the app can reach
SQLite.

The health check is at <http://localhost:8094/api/health>:

```json
{"status":"ok","checks":{"database":"ok"}}
```

It returns HTTP 503 with `"database":"unavailable"` when the database can't be reached.

On start, the container applies any pending migrations, then starts the server. Its data lives
on the `taskforge-data` volume, which survives restarts, rebuilds and `docker compose down`.

## Everyday commands

Run them from the repository folder. They are the same in PowerShell and Bash.

| Task | Command |
|---|---|
| Start, or rebuild after changes | `docker compose up --build -d` |
| Follow the logs | `docker compose logs -f app` |
| Status and health | `docker compose ps` |
| Stop, keeping data | `docker compose down` |
| Apply migrations by hand | `docker compose exec app node migrator/migrate.mjs` |

## Development

The `dev` service mounts the source into a Node container, so you get live reload without
installing Node locally:

```bash
docker compose --profile dev up dev
```

Open <http://localhost:3000>. The first start installs dependencies into `node_modules` and
takes a few minutes; later starts are quicker. The dev server uses its own database,
`data/dev.db`, separate from the app container's volume.

Use the same service for every npm command:

| Task | Command |
|---|---|
| Unit and end-to-end tests | `docker compose run --rm dev npm test` |
| Lint | `docker compose run --rm dev npm run lint` |
| Type check | `docker compose run --rm dev npm run typecheck` |
| Production build | `docker compose run --rm dev npm run build` |
| Generate a migration after editing `server/database/schema.ts` | `docker compose run --rm dev npm run db:generate` |
| Apply migrations to the dev database | `docker compose run --rm dev npm run db:migrate` |
| Install a package | `docker compose run --rm dev npm install <package>` |

The end-to-end tests build the app and start it against an in-memory database.

## Resetting local data

> **Warning:** this permanently deletes every project, task and session in the local app.

```bash
docker compose down --volumes
docker compose up -d
```

`--volumes` removes the `taskforge-data` volume. A plain `docker compose down` never does.

To reset only the dev database, delete it. In PowerShell:

```powershell
Remove-Item data/dev.db*
```

In Bash:

```bash
rm data/dev.db*
```

## Configuration

Settings live in `.env`, copied from [.env.example](.env.example). Never commit `.env`.

| Variable | Default | Purpose |
|---|---|---|
| `APP_PORT` | `8094` | Host port of the app container |
| `DEV_PORT` | `3000` | Host port of the dev server |
| `DEV_UID`, `DEV_GID` | `1000` | Linux only: the user the dev container runs as (see Troubleshooting) |
| `NUXT_DATABASE_URL` | `file:./data/taskforge.db` | Database URL for running outside Docker; Turso uses `libsql://…` |
| `NUXT_DATABASE_AUTH_TOKEN` | *(empty)* | Turso auth token |

## Project layout

```text
app/                 Vue pages, components and styles
server/api/          HTTP routes (/api/...)
server/database/     Drizzle schema and generated SQL migrations
server/utils/        Server helpers, auto-imported (database connection)
scripts/migrate.mjs  Applies migrations: Docker start, dev, CI and deploys
tests/unit/          Unit tests
tests/e2e/           Tests against the built server
docs/SPEC.md         Product specification and roadmap
```

## Troubleshooting

- **Port already in use:** set another `APP_PORT` or `DEV_PORT` in `.env`, then run
  `docker compose up -d` again.
- **Slow dev server on Windows:** a project in a Windows folder (`C:\…`) reaches the container
  through a slower file share, so the dev service polls for changes. Cloning inside WSL
  (for example `~/projects/taskforge` in Ubuntu) and running Docker from there is much faster.
- **Edits don't reload:** make sure the `dev` service is running (`docker compose ps`).
  Polling is on by default (`WATCH_POLLING=true` in `compose.yaml`).
- **`EACCES` / permission denied on Linux:** the dev container runs as user id 1000 by default,
  the usual id of the first Linux user. If `id -u` shows something else, add your ids to `.env`:

  ```bash
  echo "DEV_UID=$(id -u)" >> .env
  echo "DEV_GID=$(id -g)" >> .env
  ```

  Files created earlier by another user can be handed back with
  `sudo chown -R "$(id -u):$(id -g)" node_modules .nuxt .output data`.
- **App container unhealthy:** check `docker compose logs app`. A failed migration stops the
  container before the server starts, and the error is in the log.
- **Docker Hub download errors** (`connection reset`, `EOF`): run the command again; pulls
  resume.
