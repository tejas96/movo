# 10 — Refactor audit (2026-10-14)

Audit of `main` at `ce44fe4`. AR/spatial work is out of scope.
Baseline: `pnpm lint` and `pnpm typecheck` pass. Paths are from the repo root.

The base is good: zod contracts are the single source of truth, en/hi/mr have the same 1648 keys,
versions are pinned, TypeScript is strict, cron jobs use a job lock, and the API has one route
guard plus a tenant-scoped Prisma client. The problems are the code that was copied around
that base, a few real bugs, and deploy safety.

## Phase 0 — Bugs to fix first

| # | Where | Problem | Fix |
|---|---|---|---|
| B1 | `apps/api/src/modules/tasks/tasks.service.ts:250`, `duties.service.ts:307`, `meetings.service.ts:284`, `payments.service.ts:223`, `bills.service.ts:272`, `expenses.service.ts:307` | Check status, then update with no status in `where`. Two calls at once both pass and points are given two times. | Put the status in the update `where`; fail when `count === 0` (copy `market.service.ts:684` `move()`). Add `@@unique([refType, refId, reason])` on `PointsLedger`. Make the monthly cap in `rewards.service.ts:43` part of the same locked step. |
| B2 | `apps/api/src/modules/maintenance/payments.service.ts:124`, `ledger.applyCredit` | Two payments for one flat at the same time can pay the same bill two times. | `pg_advisory_xact_lock` per flat, or `SELECT … FOR UPDATE` on open bills. |
| B3 | `apps/api/src/modules/tenancy/roles.service.ts:145`, `societies.service.ts:143` | Role permissions are copied only when a society is made. A new permission key gives old admins 403, and they cannot fix it. | Sync system-role permissions on boot (or in a migration). |
| B4 | `apps/mobile/src/core/auth/use-bootstrap.ts:9`, `core/auth/auth.ts:57` | Phone offline at launch with an old token → splash screen forever. | Catch network errors; boot as "offline"; retry when online. |
| B5 | `apps/mobile/src/core/api/client.ts:76` | Any non-2xx on token refresh (also 5xx, deploy blip) signs the user out. | Sign out only on 401/403. Throw a retry error for 5xx. |
| B6 | `apps/mobile/src/features/market/ListingDetailScreen.tsx:113` | Archive fails but the screen still closes. | `run()` returns a boolean; go back only on success. |
| B7 | `apps/mobile/src/features/rewards/RewardsScreen.tsx:46` | Member picker uses only the first 30 members. | Search sheet backed by directory search. |
| B8 | 62 of 80 mobile screens | No error state. "Server down" looks like "empty", and detail screens show a skeleton forever. | `<QueryState>` component (see Phase 2). |

## Phase 1 — Deploy and data safety

| # | Where | Problem | Fix |
|---|---|---|---|
| D1 | `infra/…/start.sh:16`, `.github/workflows/deploy.yml:211` | Migrations run on start with no fresh backup and no rollback. Last backup can be 24 h old. | Backup before `up`. Run migrations as their own step. On a bad health check, put the previous `API_IMAGE` back. |
| D2 | `apps/api/src/app.controller.ts:9` | `/health` does not touch the DB; version is always `0.0.1`. | `/health/ready` with `SELECT 1`; bake `GIT_SHA` into the image. |
| D3 | `.github/workflows/ci.yml` | The API Docker image is built only after merge. | PR job: build image, start on CI Postgres, curl `/health`. |
| D4 | `apps/api/src/common/prisma/tenant-prisma.service.ts:93` | All 68 `$transaction` calls skip the automatic `societyId` filter. Safety depends on ~135 hand-typed filters. | `TenantPrismaService.tx(fn)` on the extended client; lint ban on raw `this.prisma` in tenant modules. |
| D5 | `tenant-prisma.service.ts:7` `TENANT_MODELS` | Forget to add a new model here → no tenant filter, no error. | Test that every Prisma model with `societyId` is in the list. |
| D6 | `infra/backup` | Restore is a manual monthly drill only. | Weekly job: restore newest dump to CI Postgres, alert on fail. |
| D7 | `release-android.yml:132` and other workflows | Third-party actions on moving tags; one gets the Play secret. | Pin to commit SHA; Dependabot bumps them. |

## Phase 2 — Make adding a feature easy (the main refactor)

Today one API feature touches ~15 files in 3 packages. One mobile screen touches 9–11 files,
5 of them shared central files, so every feature PR conflicts.

**API**

1. `Recipients` service (`ofMemberships`, `withPermission`, `ofFlats`, `ofAudience`) and one
   `notify(kind, entity)`. Replaces 24 hand-built `notifyUsers` calls in 12 files, 5 copies of
   membership→user lookup, 4 copies of "members with permission X", 6 copies of the flat label.
2. Use `slicePage` everywhere (5 hand-made cursors). Make `AuditService` `@Global` (15 copies).
3. `ScheduledItemService<T>` for meetings + events (~60 % shared code).
4. Split god services: `market.service.ts` (930 lines) → listings, moderation, orders, pure
   `order-state.ts` (state machine is written two times today). `duties.service.ts` → move the
   job code to `duties.job`. `expenses.service.ts` → categories / expenses / income.
5. Move date/FY helpers from `maintenance/billing.ts` to `common/util/dates`. Stop `common/`
   importing feature modules (`common/route/route.guard.ts:5`).
6. Lifecycle hook registry (`onSocietyCreated`, `onMemberLeft`) so `societies.service.ts` and
   `auth.service.ts deleteAccount` stop knowing every module. This also fixes deleted members
   staying assigned to tasks and duties.
7. Home: each module gives its own home section to a registry, instead of `home.service.ts`
   calling ~12 services one by one.

**Mobile**

1. `features/<x>/routes.tsx` exports screens, params and notification targets.
   `RootNavigator.tsx`, `types.ts` and `core/notifications/open-target.ts` map over a registry.
2. Per-feature query keys (`xKeys(societyId)` with `all/lists/detail`) in the feature `api.ts`.
   Remove the shared `core/api/keys.ts` and the 10 hand-built key spreads.
3. Shared building blocks: `<QueryState>`, `<PagedList>`, `useCursorList()` (11 copies),
   `useMutationToast()` / global `MutationCache.onError` (47 try/catch copies).
4. `HomeScreen.tsx` (804 lines): attention-type registry; hero and animation in own files;
   invalidate home from one mutation-cache hook instead of 13 places.
5. Editors: react-hook-form + `zodResolver(contract.body)` in all 13 editors. Today they use up to
   18 `useState` each and a pre-fill effect that overwrites typing on refetch.
6. One `request()` core in `core/api/client.ts`; `postPhoto` stops copying it.
7. Server sends `can*` flags on every entity (like market) instead of mixed client checks.

**Contracts**

1. Split `society.contract.ts` (29 routes) into structure / members / invitations / roles / audit.
   Move `societyParams` (15 copies) to `core/common.ts`.
2. Test that Prisma enums and zod enums match (9 have no match today).
3. `exports` map in `@movo/contracts` and `@movo/i18n` so tsc and Metro read the same source.

## Phase 3 — Scale

| # | Problem | Fix |
|---|---|---|
| S1 | In-memory caches (`common/tenant/tenant-cache.ts`) and throttler. With 2 replicas a logout or role removal still works on the other one for 60 s. | Stay on 1 replica for now (document it). Later: Postgres `LISTEN/NOTIFY` for invalidation and a shared throttler store. |
| S2 | SOS pushes wait behind bill reminders in the outbox (`delivery.job.ts:24`). | Send EMERGENCY at once; order by priority; claim rows with `FOR UPDATE SKIP LOCKED`; bulk status update. |
| S3 | Jobs load all rows of all societies and do per-row queries (`duties.service.ts:429`, `bills.service.ts:387`). `withJobLock` holds a connection the whole run and drops the lock after 120 s. | Batch per society, bulk insert, lock table with a lease. |
| S4 | Heavy work in requests: bill generation, FY report summed in JS, unread count loads all messages. | SQL `groupBy`/counts; bulk `createMany`. |
| S5 | Audience filter after the query (notices, meetings, events) → short pages. | Store audience in columns or a join table; filter in SQL. |
| S6 | Missing indexes: `MembershipRole(roleId)`, `Payment(societyId, createdAt)`. 35 `*MembershipId` columns have no FK. | Add indexes; add relations so member names load with a join. |
| S7 | Push is sent after commit; a crash loses it. | Write the outbox row inside the same transaction. |
| S8 | React Query not tied to app focus or network; polls run in background. | `focusManager` + `onlineManager` setup. |

## Phase 4 — Clean-up

- `icon-data.ts` is 350 KB; 24 icons unused. Emit compact data, `bold` only where used.
- Status pill copied in 7 features → `<StatusPill>` in the design system.
- 19 unused i18n keys; add a CI check for unused/missing keys.
- Date helpers in two files with two time-zone rules → one `core/util/date.ts`.
- Hard-coded colours (`#FFFFFF`, `#111111`) and 12 copies of the textarea style → tokens and `<TextArea>`.
- Dockerfile: copy lockfile first so `pnpm install` is cached. Pin base image digests.
- CI: one composite setup action, cache `.turbo`, path filter on the 45-min Android job.
- `turbo.json` `globalDependencies` add `packages/config/tsconfig/**`.
- pnpm `catalog:` for shared versions. Turn on Biome `noFloatingPromises`.
- Dead code: `safeEqual`, `resetEnvForTests`, `@nestjs/event-emitter`, `useVehicles`, `pushAvailable`.
- Tests: no mobile tests; no API tests for home, rewards, jobs, or races. Add race tests with B1/B2.
