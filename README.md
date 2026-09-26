# MOVO

A calm, multi-tenant "Smart Society" app for housing societies in India.

- Residents: "Everything important about my society, in one simple app."
- Admins: "Less manual coordination, better transparency, easier management."
- Platform: one codebase, many societies, strict data isolation.

## Status

Foundation built. The API serves auth, societies, membership, invitations, join requests, notices, notifications and the Home summary, with an end-to-end test suite. The Android app signs in, joins a society, and shows Home, Society, Notices, Directory, Money (placeholder), Me, and the admin screens. Next: meetings, events, dues, duties, tasks.

Plan: [`docs/`](docs/README.md). Run it locally: [`docs/07-dev-setup.md`](docs/07-dev-setup.md).

## Stack (decided)

| Layer | Choice |
| --- | --- |
| Monorepo | pnpm + Turborepo, Biome for lint and format |
| Backend | NestJS + TypeScript, PostgreSQL, Prisma |
| Mobile | React Native CLI (Android first, iOS in code), NativeWind (Tailwind), Poppins, Iconsax |
| Contracts | `@movo/contracts` with Zod, shared by API and app |
| Push | Firebase Cloud Messaging (project to be created later) |

## Repo layout

```
apps/            api (NestJS + Prisma), mobile (React Native + NativeWind)
packages/
  config/        shared tsconfig presets
  design-system/ tokens, Tailwind preset, Poppins fonts, Iconsax icon data, RN primitives
  contracts/     Zod schemas + route definitions, shared by API and app
  i18n/          en / hi / mr translation resources + formatters
docs/            product, architecture, data model, roadmap, design system, dev setup
infra/           docker compose for local Postgres
```

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
