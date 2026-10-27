#!/bin/sh
# Start of the Docker dev container: session secret, dependencies on the first run, migrations,
# then the live-reload server.
set -eu

. scripts/session-secret.sh
[ -d node_modules ] || npm ci
npm run db:migrate
exec npm run dev -- --host 0.0.0.0 --port 3000
