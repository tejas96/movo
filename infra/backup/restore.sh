#!/bin/sh
# Restore drill: load a backup into a SCRATCH database and print row counts.
# Never touches the live database.
#
#   restore.sh                          # newest daily backup -> movo_restore_drill
#   restore.sh /backups/monthly/x.dump.gz my_scratch_db
#   restore.sh --check                  # newest daily -> movo_restore_check, check, drop it.
#                                       # Exit 1 (and a heartbeat /fail ping) if it does not load.
#
# Env (libpq): PGHOST PGPORT PGUSER PGPASSWORD. PGDATABASE is the live DB name and is refused
# as a target. BACKUP_DIR default /backups.
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
CHECK=0
if [ "${1:-}" = "--check" ]; then
  CHECK=1
  shift
  set -- "" movo_restore_check
  HEARTBEAT="${BACKUP_HEARTBEAT_URL:-}"
  trap 'code=$?; [ "$code" -ne 0 ] && [ -n "$HEARTBEAT" ] && curl -fsS -m 10 -o /dev/null "${HEARTBEAT%/}/fail"; exit "$code"' EXIT
fi
FILE="${1:-}"
TARGET="${2:-movo_restore_drill}"
LIVE="${PGDATABASE:-movo}"

if [ -z "$FILE" ]; then
  FILE=$(find "$BACKUP_DIR/daily" -maxdepth 1 -name '*.dump.gz' | sort | tail -n 1)
  [ -n "$FILE" ] || { echo "restore: no backups in $BACKUP_DIR/daily" >&2; exit 1; }
fi
[ -f "$FILE" ] || { echo "restore: $FILE not found" >&2; exit 1; }

case "$TARGET" in
  "$LIVE" | movo | movo_test | postgres | template0 | template1)
    echo "restore: refusing to restore into '$TARGET'. Pick a scratch database name." >&2
    exit 1
    ;;
esac

echo "restore: $FILE -> $TARGET"
psql -v ON_ERROR_STOP=1 -d postgres -qc "DROP DATABASE IF EXISTS \"$TARGET\" WITH (FORCE)"
psql -v ON_ERROR_STOP=1 -d postgres -qc "CREATE DATABASE \"$TARGET\""
gunzip -c "$FILE" | pg_restore --no-owner --no-privileges --exit-on-error -d "$TARGET"

echo "restore: done. Row counts:"
psql -d "$TARGET" -At -F ' ' -c "
  SELECT 'migrations', count(*) FROM _prisma_migrations
  UNION ALL SELECT 'users', count(*) FROM \"User\"
  UNION ALL SELECT 'societies', count(*) FROM \"Society\"
  UNION ALL SELECT 'memberships', count(*) FROM \"Membership\""
if [ "$CHECK" = 1 ]; then
  migrations=$(psql -d "$TARGET" -At -c 'SELECT count(*) FROM _prisma_migrations')
  psql -v ON_ERROR_STOP=1 -d postgres -qc "DROP DATABASE \"$TARGET\" WITH (FORCE)"
  [ "$migrations" -gt 0 ] || { echo "restore check: FAILED, no migrations in $FILE" >&2; exit 1; }
  echo "restore check: ok ($FILE loads, $migrations migrations)"
  exit 0
fi
echo "restore: drop it when done: psql -d postgres -c 'DROP DATABASE \"$TARGET\"'"
