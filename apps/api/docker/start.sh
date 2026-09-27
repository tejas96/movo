#!/bin/sh
# Container start: apply pending migrations, then run the API.
# Set SKIP_MIGRATIONS=1 to start without migrating (for example a second replica).
#
# Started as root: a fresh volume (a new Docker volume or a bind mount) is owned by root, so first
# give FILES_DIR to `node`, then re-run this script as `node`. Migrations and the API never
# run as root.
set -eu
if [ "$(id -u)" = "0" ]; then
  files="${FILES_DIR:-/data/files}"
  mkdir -p "$files"
  chown node:node "$files"
  export HOME=/home/node USER=node
  exec setpriv --reuid=node --regid=node --init-groups --inh-caps=-all "$0" "$@"
fi
if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  echo "movo-start: prisma migrate deploy"
  cd /app && node node_modules/prisma/build/index.js migrate deploy
fi
echo "movo-start: starting API"
exec node /app/dist/main.js
