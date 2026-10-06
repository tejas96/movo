# MOVO — working rules

Multi-tenant housing-society app: NestJS API + React Native app in a pnpm/Turborepo monorepo.
Read `docs/README.md` for the plan, `docs/07-dev-setup.md` to run it, `docs/08-release-and-ops.md`
for production. Report to the user in plain, short English.

## Flow: feature to production

1. **Branch.** Work on a branch from `origin/main` (`feat/<name>`, `fix/<name>`). The shared folder
   `/Volumes/works-space/movo` may be on another session's branch with unsaved work: run
   `git branch --show-current` and `git status` first. If it is not yours, use a worktree
   (`git worktree add -b feat/<name> ../movo-<name> origin/main`) and never switch or stash
   someone else's files.
2. **Build and check locally** (docs/07, section 4): `pnpm lint`, `pnpm typecheck`,
   `pnpm --filter @movo/api test`. New API behaviour gets an e2e test; new strings go into
   en, hi and mr. Contracts change in `packages/contracts` first.
3. **PR to `main`.** CI runs lint, typecheck, tests, design preview and an Android release
   build. Merge when green (squash).
4. **API ships by itself.** Green CI on `main` → `Deploy` builds the arm64 image and updates the
   Oracle VM (`https://movo-society.duckdns.org`). Migrations run on container start; they
   only move forward. Check with `infra/server/check.sh`.
5. **App release when you want one.** Bump `version` in `apps/mobile/package.json` (PR),
   then tag: `git tag v<version> origin/main && git push origin v<version>`. `Release Android`
   builds the signed AAB (versionCode = major*10000 + minor*100 + patch) and uploads it to Play
   internal testing once Play is set up. Raise `MIN_SUPPORTED_APP_VERSION` / `LATEST_APP_VERSION`
   in the server `.env.prod` only when an API change needs the new app.

Commit only the files of your change. Commit messages: short imperative subject, body says why.

## Rules that do not change

- Look: mono white / soft gray / black, Poppins, Iconsax icons, bundled Unsplash photos as the
  only colour. No new colour themes or icon packs. See `docs/06-design-system.md`.
- Languages: English, Hindi, Marathi for every user-facing string (`packages/i18n`). Hermes on
  Android has no `Intl.RelativeTimeFormat`; use the helper in `@movo/i18n`.
- Tenancy: every society-scoped query is filtered by society; add a cross-tenant e2e test for
  new endpoints.
- Cost: ₹0 a month. Nothing outside Oracle Always Free, Firebase Spark, GitHub free tiers
  without asking the user. Money, publishing, account creation and deletes: ask first.
- Secrets never go in git, images, chat or docs. Where each one lives:
  `.private/MOVO-VAULT.md` (git- and docker-ignored; read it for locations, never paste it).
  Update the vault when an account, key, IP or URL changes.
- Do not use the "superpowers" skills on this project.
- The AR/spatial work (`docs/09-…`, `docs/spatial/`, `packages/ar-native`,
  `apps/mobile/src/features/ar`) belongs to a separate track; leave it alone unless asked.

## Pending (placeholders)

Things that wait on the user or on Google are listed in `docs/08-release-and-ops.md`,
section "Pending". When one completes, wire it in and remove it from that list.
