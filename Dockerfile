# syntax=docker/dockerfile:1
# Production-like image: the built Nuxt server plus the migration script, run as a non-root
# user. Local and CI use; Vercel builds the app itself from source.

FROM node:24-slim AS base
WORKDIR /app
ENV npm_config_update_notifier=false

# All dependencies, reproducibly from the lockfile.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Build the server (.output is self-contained: Nitro copies in only the modules it uses).
FROM deps AS build
COPY . .
RUN npx nuxt prepare && npm run build

# The migration script runs outside the built server, so it gets its own two packages, pinned
# to the versions in the lockfile.
FROM base AS migrator
COPY package-lock.json ./
RUN node -e "const l=require('./package-lock.json').packages;console.log(['drizzle-orm','@libsql/client'].map(n=>n+'@'+l['node_modules/'+n].version).join(' '))" > /tmp/packages \
    && npm install --no-save --no-package-lock --ignore-scripts $(cat /tmp/packages)

FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    NUXT_DATABASE_URL=file:/app/data/taskforge.db \
    MIGRATIONS_DIR=/app/migrator/migrations
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=migrator --chown=node:node /app/node_modules ./migrator/node_modules
COPY --from=build --chown=node:node /app/scripts/migrate.mjs ./migrator/migrate.mjs
COPY --from=build --chown=node:node /app/server/database/migrations ./migrator/migrations
COPY --from=build --chown=node:node /app/scripts/docker-start.sh ./start.sh
COPY --from=build --chown=node:node /app/scripts/session-secret.sh ./session-secret.sh
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Migrations are safe to run on every start: applied ones are skipped, and SQLite here has a
# single writer (this container). Run through sh, so the script needs no executable bit.
CMD ["sh", "start.sh"]
