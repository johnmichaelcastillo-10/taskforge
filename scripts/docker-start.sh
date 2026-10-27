#!/bin/sh
# Start of the Docker app container: session secret, migrations, then the server.
set -eu

. ./session-secret.sh
node migrator/migrate.mjs
exec node .output/server/index.mjs
