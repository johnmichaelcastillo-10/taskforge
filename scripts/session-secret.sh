# Sourced by the containers' start scripts, from /app.
#
# Sessions are encrypted with NUXT_SESSION_PASSWORD. When .env doesn't set one, generate one
# into data/session-password on the first start and reuse it afterwards, so sign-ins survive
# restarts. data/ is the volume in the app container and a git-ignored folder in development.
if [ -z "${NUXT_SESSION_PASSWORD:-}" ]; then
  if [ ! -s data/session-password ]; then
    mkdir -p data
    (umask 077 && node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))" > data/session-password)
  fi
  NUXT_SESSION_PASSWORD=$(cat data/session-password)
  export NUXT_SESSION_PASSWORD
fi
