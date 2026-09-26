# infra

Local development only, for now.

```bash
docker compose -f infra/docker-compose.yml up -d      # Postgres 17 on localhost:5433 (dbs: movo, movo_test)
docker compose -f infra/docker-compose.yml down       # stop (data kept)
docker compose -f infra/docker-compose.yml down -v    # stop and wipe data
```

Production compose (api + postgres + caddy + backup) is added with the deploy milestone.
