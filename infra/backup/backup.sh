#!/bin/sh
# One backup run: pg_dump (custom format) | gzip into BACKUP_DIR, keep 14 daily + 6 monthly,
# optional rclone copy off-site, optional heartbeat ping.
#
#   backup.sh             the nightly run
#   backup.sh predeploy   a quick dump right before a deploy migrates the database: kept in
#                         BACKUP_DIR/predeploy (newest KEEP_PREDEPLOY, default 5), no monthly
#                         copy, no photo mirror, no off-site copy, no heartbeat
#
# Env (libpq): PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
# Env (ours):
#   BACKUP_DIR            default /backups
#   KEEP_DAILY            default 14
#   KEEP_MONTHLY          default 6
#   RCLONE_REMOTE         e.g. offsite:movo-backups  (empty = local only)
#   BACKUP_HEARTBEAT_URL  e.g. https://hc-ping.com/<uuid>  (empty = no ping)
set -eu
# A failing pg_dump must fail the run, not hide behind a successful gzip.
set -o pipefail

MODE="${1:-daily}"
case "$MODE" in daily | predeploy) ;; *) echo "backup: unknown mode $MODE" >&2; exit 2 ;; esac
BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_PREDEPLOY="${KEEP_PREDEPLOY:-5}"
KEEP_DAILY="${KEEP_DAILY:-14}"
KEEP_MONTHLY="${KEEP_MONTHLY:-6}"
DB="${PGDATABASE:?PGDATABASE is required}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
HEARTBEAT="${BACKUP_HEARTBEAT_URL:-}"
[ "$MODE" = predeploy ] && HEARTBEAT=""

log() { echo "backup $(date '+%Y-%m-%d %H:%M:%S %Z'): $*"; }
ping_hc() {
  [ -n "$HEARTBEAT" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "$1" || log "heartbeat ping failed ($1)"
}

tmp=""
finish() {
  code=$?
  [ -n "$tmp" ] && rm -f "$tmp"
  if [ "$code" -ne 0 ]; then
    log "FAILED (exit $code)"
    ping_hc "${HEARTBEAT%/}/fail"
  fi
  exit "$code"
}
trap finish EXIT

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/monthly" "$BACKUP_DIR/predeploy"
stamp=$(date +%Y-%m-%d_%H%M%S)
month=$(date +%Y-%m)
daily="$BACKUP_DIR/daily/${DB}-${stamp}.dump.gz"
[ "$MODE" = predeploy ] && daily="$BACKUP_DIR/predeploy/${DB}-${stamp}.dump.gz"
monthly="$BACKUP_DIR/monthly/${DB}-${month}.dump.gz"

ping_hc "${HEARTBEAT%/}/start"
log "dumping ${DB}@${PGHOST:-localhost}"
tmp="${daily}.partial"
# -Z0: no compression inside the dump, gzip does it once outside.
pg_dump --format=custom --compress=0 --no-owner --no-privileges "$DB" | gzip -6 > "$tmp"
gzip -t "$tmp"
# pg_restore --list proves the archive is readable, not just a valid gzip stream. It stops
# reading after the table of contents, so gunzip may get SIGPIPE; gzip -t above covered it.
{ gunzip -c "$tmp" || true; } | pg_restore --list > /dev/null
mv "$tmp" "$daily"
tmp=""
log "wrote $daily ($(du -h "$daily" | cut -f1))"

prune() { # dir keep
  # Names sort by date, so newest last; delete everything before the newest $2.
  total=$(find "$1" -maxdepth 1 -name '*.dump.gz' | wc -l)
  drop=$((total - $2))
  [ "$drop" -gt 0 ] || return 0
  find "$1" -maxdepth 1 -name '*.dump.gz' | sort | head -n "$drop" | while read -r f; do
    rm -f "$f"
    log "pruned $f"
  done
}

if [ "$MODE" = predeploy ]; then
  prune "$BACKUP_DIR/predeploy" "$KEEP_PREDEPLOY"
  log "done"
  exit 0
fi

# First backup of the month becomes the monthly copy.
if [ ! -f "$monthly" ]; then
  cp "$daily" "$monthly"
  log "wrote $monthly"
fi

prune "$BACKUP_DIR/daily" "$KEEP_DAILY"
prune "$BACKUP_DIR/monthly" "$KEEP_MONTHLY"

# Uploaded photos: a plain mirror next to the dumps. New files are copied, nothing is deleted,
# so a photo removed by mistake can still be found here.
if [ -d "${FILES_DIR:-/files}" ]; then
  mkdir -p "$BACKUP_DIR/files"
  cp -Rpu "${FILES_DIR:-/files}/." "$BACKUP_DIR/files/"
  log "mirrored uploaded files ($(du -sh "$BACKUP_DIR/files" | cut -f1))"
fi

if [ -n "$RCLONE_REMOTE" ]; then
  log "copying off-site to $RCLONE_REMOTE"
  rclone copy --no-traverse "$daily" "$RCLONE_REMOTE/daily/"
  rclone copy --no-traverse "$monthly" "$RCLONE_REMOTE/monthly/"
  if [ -d "$BACKUP_DIR/files" ]; then rclone copy "$BACKUP_DIR/files" "$RCLONE_REMOTE/files/"; fi
  # Same retention off-site, by age.
  rclone delete --min-age "$((KEEP_DAILY + 1))d" "$RCLONE_REMOTE/daily/"
  rclone delete --min-age "$((KEEP_MONTHLY * 31 + 1))d" "$RCLONE_REMOTE/monthly/"
fi

ping_hc "$HEARTBEAT"
log "done"
