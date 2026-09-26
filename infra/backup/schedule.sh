#!/bin/sh
# Runs backup.sh every day at BACKUP_AT (default 02:30) in the container's TZ (Asia/Kolkata).
# A plain sleep loop instead of cron: the environment reaches the job as-is and logs go to
# `docker compose logs backup`.
set -eu
AT="${BACKUP_AT:-02:30}"
echo "backup scheduler: daily at ${AT} ($(date +%Z))"
while true; do
  now=$(date +%s)
  target=$(date -d "$(date +%Y-%m-%d) ${AT}" +%s)
  [ "$target" -le "$now" ] && target=$((target + 86400))
  echo "backup scheduler: next run $(date -d "@${target}" '+%Y-%m-%d %H:%M %Z')"
  sleep $((target - now))
  backup.sh || echo "backup scheduler: backup failed, will try again tomorrow" >&2
done
