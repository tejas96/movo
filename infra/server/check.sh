#!/usr/bin/env bash
# Read-only health report for the production VM. Changes nothing.
#
#   infra/server/check.sh                      # default host below
#   MOVO_HOST=ubuntu@<ip> infra/server/check.sh
#
# Shows: public /health, certificate expiry, containers, memory, disk, newest local and
# off-site backups, pending reboot.
set -euo pipefail
HOST=${MOVO_HOST:-ubuntu@92.4.70.154}
KEY=${MOVO_SSH_KEY:-$HOME/.ssh/movo_oracle}
DOMAIN=${MOVO_DOMAIN:-movo-society.duckdns.org}

echo "== https://$DOMAIN/health"
curl -fsS -m 15 "https://$DOMAIN/health" || echo "HEALTH FAILED"
echo
echo "== certificate"
echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null \
  | openssl x509 -noout -enddate 2>/dev/null || echo "no certificate"

ssh -i "$KEY" -o BatchMode=yes "$HOST" 'bash -s' <<'REMOTE'
set -u
cd /opt/movo
dc() { docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"; }
echo "== containers"
dc ps --format '{{.Service}}\t{{.Status}}' </dev/null
echo "== image"
grep '^API_IMAGE=' .env.prod
echo "== memory"
free -m | sed -n '1,3p'
docker stats --no-stream --format '{{.Name}}\t{{.MemUsage}}' </dev/null
echo "== disk"
df -h / | tail -1
du -sh backups 2>/dev/null
echo "== newest local backups"
ls -1t backups/daily 2>/dev/null | head -3
echo "== off-site (newest daily)"
dc exec -T backup sh -c '[ -n "${RCLONE_REMOTE:-}" ] && rclone lsl "$RCLONE_REMOTE/daily/" 2>/dev/null | sort -k2,3 | tail -2 || echo "off-site not set"' </dev/null
echo "== reboot"
[ -f /var/run/reboot-required ] && echo "REBOOT NEEDED (do it at a quiet hour: sudo reboot)" || echo "not needed"
REMOTE
