#!/usr/bin/env bash
# Photo bucket on the VM (docs/08, "Photo storage").
#
#   infra/server/set-files-key.sh            put the movo-files key on the VM, copy the photos
#   infra/server/set-files-key.sh --switch   start serving photos from the bucket
#
# Without --switch the API keeps using the disk: this only saves the key, restarts the api and
# copies every photo into the bucket, which also proves the key works. Run it again any time;
# it skips photos already copied. With --switch it copies once more (photos added since), sets
# STORAGE_DRIVER=s3 and restarts the api. Switch back by setting STORAGE_DRIVER=disk.
#
# Both key answers are hidden. For the access key you can paste the whole row from the Oracle
# list; the 40-character ID is picked out. Nothing is saved on this Mac. The bucket endpoint is
# the one the backups already use (same namespace). A new key can answer 403 for a minute or
# two, so the copy retries.
set -euo pipefail
HOST=${MOVO_HOST:-ubuntu@92.4.70.154}
KEY=${MOVO_SSH_KEY:-$HOME/.ssh/movo_oracle}
MODE=${1:-key}

if [ "$MODE" = "--switch" ]; then
  AK="" SK=""
else
  read -r -s -p "1) Access key of movo-files-bot (paste the row or the ID, hidden): " AK; echo
  AK=$(printf '%s' "$AK" | tr -s ' \t' '\n' | grep -iE '^[0-9a-f]{40}$' | tail -1 || true)
  [ -n "$AK" ] || { echo "No 40-character access key ID found. Run again."; exit 1; }
  echo "   Access key ID: ${AK:0:6}..."
  read -r -s -p "2) Secret key (hidden): " SK; echo
  [ -n "$SK" ] || { echo "The secret is empty. Run again."; exit 1; }
fi

# stdin carries the mode and the two values first, then the script; the remote shell reads the
# values and runs the rest. Commands inside that could read stdin get </dev/null.
{ printf '%s\n%s\n%s\n' "$MODE" "$AK" "$SK"; cat <<'REMOTE'
set -euo pipefail
cd /opt/movo
esc() { printf '%s' "$1" | sed -e 's/[\/&#]/\\&/g'; }
# Sets KEY=VALUE in .env.prod, adding the line when an older file does not have it yet.
put() {
  if grep -q "^$1=" .env.prod; then sed -i "s#^$1=.*#$1=$(esc "$2")#" .env.prod
  else printf '%s=%s\n' "$1" "$2" >> .env.prod; fi
}
get() { grep "^$1=" .env.prod | tail -1 | cut -d= -f2- || true; }
dc() { docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"; }
grep -q 'S3_BUCKET' docker-compose.prod.yml || {
  echo "The compose file on the VM has no photo settings yet. Merge and deploy the photo PR first."; exit 1; }

cp -p .env.prod ".env.prod.bak-$(date +%Y%m%d%H%M)"
if [ "$MODE" != "--switch" ]; then
  ENDPOINT=$(get S3_ENDPOINT); [ -n "$ENDPOINT" ] || ENDPOINT=$(get RCLONE_S3_ENDPOINT)
  [ -n "$ENDPOINT" ] || { echo "No endpoint: set S3_ENDPOINT in .env.prod first."; exit 1; }
  put STORAGE_DRIVER "$(get STORAGE_DRIVER | grep . || echo disk)"
  put S3_ENDPOINT "$ENDPOINT"
  put S3_REGION "$(get S3_REGION | grep . || echo ap-mumbai-1)"
  put S3_BUCKET "$(get S3_BUCKET | grep . || echo movo-files)"
  put S3_ACCESS_KEY_ID "$AK"
  put S3_SECRET_ACCESS_KEY "$SK"
fi
dc up -d api </dev/null >/dev/null 2>&1
for i in $(seq 1 20); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$(dc ps -q api)" 2>/dev/null)" = healthy ] && break
  sleep 3
done

copied=no
for i in 1 2 3 4 5 6; do
  if dc exec -T api node dist/cli/files.js copy-to-s3 </dev/null >/tmp/movo-files.log 2>&1; then
    copied=yes; break
  fi
  echo "   try $i: not yet, waiting 30 s"; sleep 30
done
tail -3 /tmp/movo-files.log
if [ "$copied" != yes ]; then
  echo "Copy to the bucket failed. The API still serves photos from the disk."
  echo "The previous settings are in /opt/movo/.env.prod.bak-* (restore with mv if needed)."
  exit 1
fi

if [ "$MODE" = "--switch" ]; then
  put STORAGE_DRIVER s3
  dc up -d api </dev/null >/dev/null 2>&1
  for i in $(seq 1 20); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$(dc ps -q api)" 2>/dev/null)" = healthy ] && break
    sleep 3
  done
  echo "Switched: the API now reads and writes photos in the bucket."
else
  echo "Saved. Photos copied to the bucket; the API still uses the disk until --switch."
fi
rm -f .env.prod.bak-*
REMOTE
} | ssh -i "$KEY" -o BatchMode=yes "$HOST" 'read -r MODE; read -r AK; read -r SK; export MODE AK SK; exec bash -s'
unset AK SK
