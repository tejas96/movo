# infra

## Local development

```bash
docker compose -f infra/docker-compose.yml up -d      # Postgres 17 on localhost:5433 (dbs: movo, movo_test)
docker compose -f infra/docker-compose.yml down       # stop (data kept)
docker compose -f infra/docker-compose.yml down -v    # stop and wipe data
```

## Production

One Oracle Cloud Always Free ARM VM in Mumbai (`ap-mumbai-1`) runs this compose stack. `.github/workflows/deploy.yml` builds the multi-arch API image, pushes it to GHCR and updates the VM over SSH.

| File | What |
| --- | --- |
| `docker-compose.prod.yml` | api (GHCR image) + postgres (no public port) + caddy (HTTPS) + backup |
| `Caddyfile` | reverse proxy for `{$API_DOMAIN}`, Let's Encrypt certificate |
| `.env.prod.example` | every production variable. Copy to `/opt/movo/.env.prod` on the VM |
| `backup/` | backup image: `backup.sh` (nightly 02:30 IST, 14 daily + 6 monthly, optional rclone copy to Oracle Object Storage or Cloudflare R2 + heartbeat), `restore.sh` (drill into a scratch db), `schedule.sh` |

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
