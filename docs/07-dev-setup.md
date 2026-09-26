# Developer setup

Everything runs on your Mac with free tools. First run takes about 15 minutes because of Gradle.

## 1. Requirements

- Node 22 (`.nvmrc`), pnpm 10 (`corepack enable` or `npm i -g pnpm@10`)
- Docker Desktop (Postgres runs in a container)
- Android Studio with SDK 36 and an emulator, or a phone with USB debugging
- Xcode 26 with CocoaPods for iOS (optional for now)

## 2. Install and prepare

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d        # Postgres 17 on localhost:5433
pnpm --filter @movo/contracts --filter @movo/i18n build # shared libs the API imports
cp apps/api/.env.example apps/api/.env                  # then edit JWT_SECRET if you like
pnpm --filter @movo/api db:deploy                       # apply migrations
pnpm --filter @movo/api seed -- --demo                  # platform admin + demo society
```

The demo seed prints:

| What | Value |
| --- | --- |
| Demo society | Sunrise Residency, Pune, wings A and B, 24 flats |
| Demo admin | phone `+919999900001`, password `demo-admin-1` |
| Invite code for flat A-102 | `DEMO1234` |
| Society join code | printed at the end of the seed output |
| Platform admin | from `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` in `.env` |
| Services | 12 categories, 6 sample vendors |
| Parking | slots P-01 to P-20, T-01 to T-10, visitor V-01; P-01 and car MH12AB1234 belong to A-101 |
| Emergency | gate, lift and office contacts plus 112, 100, 101, 108 |
| Meetings and events | a committee meeting in 5 days, a garba night in 10 days |
| Duties, tasks, rewards | "Main gate locking" monthly over wing A (A-101's turn now), an open task worth 3 points, 5 points for the admin |
| Expenses | 10 categories, five approved expenses this month, one hall booking |
| Market | switched on; poha and chai (food, from the second member if there is one), mango pickle, maths tuition, kids cycle; photos copied into `apps/api/data/files` |
| Money | plan "Maintenance" ₹2,500 monthly, due on the 10th, ₹100 late fee after 5 days; UPI `sunriseresidency@okaxis`; this month's bills; 16 flats paid, A-101 (the admin) not |

Running the seed again on an existing demo society only adds the Services, Parking, Emergency, Meetings, Events, Money, Expenses, Duties, Tasks, Rewards and Market data that is missing.

## 3. Run

```bash
pnpm --filter @movo/api dev          # API on http://localhost:4000, restarts on change
pnpm --filter @movo/mobile start     # Metro
pnpm --filter @movo/mobile android   # build and install the debug app on the running emulator
```

The Android emulator reaches the API at `http://10.0.2.2:4000` (set in `apps/mobile/.env`). On a real phone, put your Mac's LAN IP there.

iOS (later): `cd apps/mobile && bundle install && bundle exec pod install`, then `pnpm --filter @movo/mobile ios`.

## 4. Check before you push

```bash
pnpm lint          # Biome, whole repo
pnpm typecheck     # every package and app
pnpm --filter @movo/api test     # unit + e2e against the movo_test database
pnpm design:preview              # regenerate the design system page
```

## 5. Where things are

| Path | What |
| --- | --- |
| `packages/contracts` | routes, schemas, enums. Change here first, both sides follow |
| `packages/i18n` | en / hi / mr text. Every key must exist in all three files (a test checks) |
| `packages/design-system` | tokens, icons, React Native primitives, preview page |
| `apps/api/src/modules/*` | one folder per bounded context |
| `apps/api/prisma/schema.prisma` | database schema. `pnpm --filter @movo/api db:migrate` after edits |
| `apps/mobile/src/features/*` | screens and their data hooks |
| `apps/mobile/src/core` | api client, session, tenant context, navigation, i18n |
| `apps/api/data/files` | uploaded photos in development (`FILES_DIR`, git-ignored) |

## 6. Common tasks

- **New API route**: add it to a contract, implement the handler with `@Route(contract.x)` and `@Input(contract.x)`, add an e2e test.
- **New screen**: create it under `features/<module>`, register it in `RootNavigator`, use only design-system components.
- **New text**: add the key to all three locale files. The i18n test fails if one is missing.
- **New icon**: add a line to `packages/design-system/src/icons/icon-map.ts`, run `pnpm --filter @movo/design-system icons`.
- **Database change**: edit `schema.prisma`, run `pnpm --filter @movo/api db:migrate --name <what-changed>`, commit the migration folder.

## 7. Troubleshooting

- `Unable to resolve module ...` in Metro: `pnpm --filter @movo/mobile start -- --reset-cache`.
- Gradle cannot find the SDK: `apps/mobile/android/local.properties` must contain `sdk.dir=/Users/<you>/Library/Android/sdk`.
- API says `Invalid environment`: a variable in `apps/api/.env` is missing. Compare with `.env.example`.
- Tests fail with connection errors: is Docker running? `docker compose -f infra/docker-compose.yml ps`.
- Gradle wrapper download times out (`Downloading https://services.gradle.org/... failed: timeout`): Java's downloader can stall on this network while curl works. Download the zip with curl and put it where the wrapper looks:
  ```bash
  curl -L -o /tmp/gradle-9.4.1-bin.zip https://services.gradle.org/distributions/gradle-9.4.1-bin.zip
  D=~/.gradle/wrapper/dists/gradle-9.4.1-bin/arn2x92ynaizyzdaamcbpbhtj && mkdir -p $D && cp /tmp/gradle-9.4.1-bin.zip $D/ && (cd $D && unzip -q gradle-9.4.1-bin.zip && touch gradle-9.4.1-bin.zip.ok)
  ```
  The hash folder name comes from the distribution URL, so it is the same on every Mac.
- `pod install` fails with `Unicode Normalization not appropriate for ASCII-8BIT`: run it with a UTF-8 locale, `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install`.
- A screen crashes with `undefined cannot be used as a constructor` on Android: Hermes has no `Intl.RelativeTimeFormat`, `Intl.ListFormat` or `Intl.DisplayNames`. Use the helpers in `@movo/i18n` instead of calling `Intl` directly.
