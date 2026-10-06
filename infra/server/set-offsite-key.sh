#!/usr/bin/env bash
# Put a new Object Storage customer secret key on the VM, restart the backup service and run
# one backup to prove it. Use it for the first key and for every rotation.
#
#   infra/server/set-offsite-key.sh            (or MOVO_HOST=ubuntu@<ip> ...)
#
# Both answers are hidden. For the access key you can paste the whole row from the Oracle
# list; the 40-character ID is picked out. Nothing is saved on this Mac. A new key can answer
# 403 for a minute or two, so the test backup retries. Delete the old key in Oracle after.
set -euo pipefail
HOST=${MOVO_HOST:-ubuntu@92.4.70.154}
KEY=${MOVO_SSH_KEY:-$HOME/.ssh/movo_oracle}

read -r -s -p "1) Access key (paste the row or the ID, hidden): " AK; echo
AK=$(printf '%s' "$AK" | tr -s ' \t' '\n' | grep -iE '^[0-9a-f]{40}$' | tail -1 || true)
[ -n "$AK" ] || { echo "No 40-character access key ID found. Run again."; exit 1; }
echo "   Access key ID: ${AK:0:6}..."
read -r -s -p "2) Secret key (hidden): " SK; echo
[ -n "$SK" ] || { echo "The secret is empty. Run again."; exit 1; }

# stdin carries the two values first, then the script; the remote shell reads the values and
# runs the rest. Commands inside that could read stdin get </dev/null so they do not eat it.
{ printf '%s\n%s\n' "$AK" "$SK"; cat <<'REMOTE'
set -euo pipefail
cd /opt/movo
esc() { printf '%s' "$1" | sed -e 's/[\/&#]/\\&/g'; }
cp -p .env.prod ".env.prod.bak-$(date +%Y%m%d%H%M)"
sed -i -e "s#^RCLONE_S3_ACCESS_KEY_ID=.*#RCLONE_S3_ACCESS_KEY_ID=$(esc "$AK")#" \
       -e "s#^RCLONE_S3_SECRET_ACCESS_KEY=.*#RCLONE_S3_SECRET_ACCESS_KEY=$(esc "$SK")#" .env.prod
dc() { docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"; }
dc up -d backup </dev/null >/dev/null 2>&1
for i in 1 2 3 4 5 6; do
  if dc exec -T backup backup.sh </dev/null >/tmp/movo-backup.log 2>&1; then
    echo "Saved. Test backup copied off-site (try $i)."
    rm -f .env.prod.bak-*
    exit 0
  fi
  echo "   try $i: not yet, waiting 30 s"; sleep 30
done
echo "Test backup still fails. Last lines:"; grep -v NOTICE /tmp/movo-backup.log | tail -5
echo "The previous settings are in /opt/movo/.env.prod.bak-* (restore with mv if needed)."
exit 1
REMOTE
} | ssh -i "$KEY" -o BatchMode=yes "$HOST" 'read -r AK; read -r SK; export AK SK; exec bash -s'
unset AK SK
