# MOVO

A calm, multi-tenant "Smart Society" app for housing societies in India.

- Residents: "Everything important about my society, in one simple app."
- Admins: "Less manual coordination, better transparency, easier management."
- Platform: one codebase, many societies, strict data isolation.

## Status

Live. The API runs at `https://movo-society.duckdns.org` on an Oracle Cloud Always Free Ampere VM in Mumbai (₹0 a month), with nightly off-site backups. The Android app covers M0–M10 of [the roadmap](docs/05-mvp-roadmap.md): notices, meetings and events, dues and receipts, expenses and reports, duties and tasks with points, directory, services, parking, emergency alerts, the neighbour market, admin and roles, push notifications, English / Hindi / Marathi, and an indoor AR guide. Google Play: developer account verification in progress; see "Pending" in [docs/08](docs/08-release-and-ops.md).

## Stack

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm + Turborepo, Biome for lint and format |
| Backend | NestJS + TypeScript, PostgreSQL 17, Prisma |
| Mobile | React Native CLI (Android first, iOS in code), NativeWind (Tailwind), Poppins, Iconsax |
| Contracts | `@movo/contracts` with Zod, shared by API and app |
| Push | Firebase Cloud Messaging (project `movo-society`, Spark plan) |
| Hosting | Docker Compose on Oracle Cloud (api, postgres, caddy, backup), DuckDNS + Let's Encrypt |
| CI/CD | GitHub Actions: CI on every PR, auto-deploy of the API from `main`, Android release on a `v*` tag, Pages for the privacy site |

## Repo layout

```
apps/
  api/           NestJS + Prisma API, Dockerfile
  mobile/        React Native app; store/ holds Play listing, forms, screenshots, release tools
packages/
  config/        shared tsconfig presets
  design-system/ tokens, Tailwind preset, Poppins fonts, Iconsax icon data, RN primitives
  contracts/     Zod schemas + route definitions, shared by API and app
  i18n/          en / hi / mr translation resources + formatters
  ar-native/     native AR view (ARKit / ARCore) for the AR guide
docs/            product, architecture, data model, roadmap, design, dev setup, release and ops
infra/           local Postgres; production compose, Caddy, backups; server/ ops scripts
site/            privacy policy and account deletion pages (GitHub Pages)
.github/         CI, Deploy, Release Android, Pages, Dependabot
```

## How changes ship

Branch → PR → CI green → merge to `main` → the API deploys by itself. For an app release, bump the version and push a `v<version>` tag. Details: [CLAUDE.md](CLAUDE.md) and [docs/08](docs/08-release-and-ops.md).

## Quick start

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @movo/contracts --filter @movo/i18n build
cp apps/api/.env.example apps/api/.env
pnpm --filter @movo/api db:deploy && pnpm --filter @movo/api seed -- --demo
pnpm --filter @movo/api dev            # http://localhost:4000
pnpm --filter @movo/mobile android     # emulator must be running
```

Demo admin: `+919999900001` / `demo-admin-1`. Invite code for a second user: `DEMO1234`.
Full guide with troubleshooting: [docs/07-dev-setup.md](docs/07-dev-setup.md).
