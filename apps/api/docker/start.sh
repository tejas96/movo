#!/bin/sh
# Container start: apply pending migrations, then run the API.
# Set SKIP_MIGRATIONS=1 to start without migrating (for example a second replica).
set -eu
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  echo "movo-start: prisma migrate deploy"
  cd /app && node node_modules/prisma/build/index.js migrate deploy
fi
echo "movo-start: starting API"
exec node /app/dist/main.js
