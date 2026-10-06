# infra

## Local development

```bash
docker compose -f infra/docker-compose.yml up -d      # Postgres 17 on localhost:5433 (dbs: movo, movo_test)
docker compose -f infra/docker-compose.yml down       # stop (data kept)
docker compose -f infra/docker-compose.yml down -v    # stop and wipe data
```

## Production

One Oracle Cloud Always Free Ampere (arm64) VM in Mumbai (`ap-mumbai-1`) runs this compose stack at `https://movo-society.duckdns.org`. `.github/workflows/deploy.yml` builds the API image for `DEPLOY_ARCHES` (default arm64), pushes it to GHCR and updates the VM over SSH after every green CI run on `main`. The live values (VM, IP, bucket, secrets) are at the top of [docs/08-release-and-ops.md](../docs/08-release-and-ops.md).

| File | What |
| --- | --- |
| `docker-compose.prod.yml` | api (GHCR image) + postgres (no public port) + caddy (HTTPS) + backup |
| `Caddyfile` | reverse proxy for `{$API_DOMAIN}`, Let's Encrypt certificate |
| `.env.prod.example` | every production variable. Copy to `/opt/movo/.env.prod` on the VM |
| `server/bootstrap.sh` | one-time setup of a fresh Ubuntu 24.04 VM (firewall, swap, Docker, SSH). Safe to run again |
| `server/check.sh` | read-only health report: /health, certificate, containers, memory, disk, newest local and off-site backups |
| `server/set-offsite-key.sh` | put a new Object Storage key on the VM (hidden prompts) and prove it with a backup |
| `backup/` | backup image: `backup.sh` (nightly 02:30 IST, 14 daily + 6 monthly, optional rclone copy to Oracle Object Storage or Cloudflare R2 + heartbeat), `restore.sh` (drill into a scratch db), `schedule.sh` |

Common tasks, from the repo root on your Mac:

```bash
infra/server/check.sh                                                     # is everything OK?
ssh -i ~/.ssh/movo_oracle ubuntu@<new-ip> 'bash -s' < infra/server/bootstrap.sh   # new VM
infra/server/set-offsite-key.sh                                           # rotate the backup key
```

The scripts default to the live VM; set `MOVO_HOST=ubuntu@<ip>` for another one.

On the VM, from `/opt/movo`:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Try the whole stack on your Mac (Caddy serves `https://localhost` with its own local certificate):

```bash
docker build -f apps/api/Dockerfile -t movo-api:local .
cp infra/.env.prod.example /tmp/movo.env   # set API_IMAGE=movo-api:local, API_DOMAIN=localhost, passwords
docker compose -p movo-prodtest -f infra/docker-compose.prod.yml --env-file /tmp/movo.env up -d --build
curl -k https://localhost/health
docker compose -p movo-prodtest -f infra/docker-compose.prod.yml --env-file /tmp/movo.env down -v
```

Server setup, deploys, backups, uptime alerts and the Android release are in [docs/08-release-and-ops.md](../docs/08-release-and-ops.md).
