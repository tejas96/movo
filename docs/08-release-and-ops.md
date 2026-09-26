# Release and operations

How MOVO goes live and stays up, for ₹0 a month. Everything in the repo works without the accounts below; each piece switches on when its account or secret exists.

| Piece | Where |
| --- | --- |
| API image | `apps/api/Dockerfile` (runs `prisma migrate deploy`, then the API) |
| Production stack | `infra/docker-compose.prod.yml`, `infra/Caddyfile`, `infra/.env.prod.example` |
| Backups | `infra/backup/` (`backup.sh`, `restore.sh`, daily scheduler) |
| Deploy | `.github/workflows/deploy.yml` (skipped until the `DEPLOY_*` secrets exist) |
| Privacy policy site | `site/` and `.github/workflows/pages.yml` |
| Android release | `apps/mobile/android/app/build.gradle`, `pnpm --filter @movo/mobile android:bundle` |

Public URLs once live:

- Privacy policy: https://tejas96.github.io/movo/privacy.html
- Account deletion: https://tejas96.github.io/movo/delete-account.html
- API health: `https://<API_DOMAIN>/health` (returns `{"status":"ok",...}`)

## 1. Accounts to create (one time)

| Account | Cost | Needed for |
| --- | --- | --- |
| Oracle Cloud (Mumbai home region) | ₹0, card needed | The server. Upgrade to pay-as-you-go so idle free VMs are not reclaimed; Always Free limits still cost ₹0 |
| A domain + Cloudflare DNS | about ₹800–1,000 a year | `api.<domain>` for HTTPS |
| GitHub Pages | ₹0 | Privacy policy. Repo Settings → Pages → Source: **GitHub Actions** |
| Google Play Console | $25 once | Publishing the app |
| Firebase (Spark plan) | ₹0 | Push notifications (FCM) |
| Resend | ₹0 (3,000 emails a month) | Password reset emails |
| UptimeRobot | ₹0 | Alerts when the API is down |
| healthchecks.io | ₹0 | Alerts when a nightly backup does not run |
| Cloudflare R2 (optional) | ₹0 up to 10 GB | Off-site copy of backups |

## 2. Server setup (once)

1. Oracle Cloud → Compute → Create instance: shape **VM.Standard.A1.Flex** (Ampere ARM), 2 OCPU / 12 GB is plenty, image **Ubuntu 24.04**, add your SSH public key. Boot volume 50 GB.
2. Networking: in the VM's subnet security list add ingress TCP 80 and 443 from `0.0.0.0/0`. Ubuntu images on Oracle also block ports with iptables:
   ```bash
   sudo iptables -I INPUT 6 -p tcp -m multiport --dports 80,443 -j ACCEPT
   sudo netfilter-persistent save
   ```
3. DNS: an `A` record `api.<domain>` → the VM's public IP. In Cloudflare keep it **DNS only** (grey cloud) so Caddy can get its certificate.
4. Docker:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER   # log out and back in
   sudo timedatectl set-timezone Asia/Kolkata
   ```
5. A deploy key for GitHub Actions (on your Mac):
   ```bash
   ssh-keygen -t ed25519 -N "" -C movo-deploy -f ~/.ssh/movo_deploy
   ssh-copy-id -i ~/.ssh/movo_deploy.pub ubuntu@<vm-ip>
   ssh-keyscan <vm-ip>          # output goes in DEPLOY_KNOWN_HOSTS
   ```
6. App folder and settings:
   ```bash
   sudo mkdir -p /opt/movo && sudo chown $USER /opt/movo
   # copy infra/.env.prod.example from the repo to /opt/movo/.env.prod, then fill it in
   chmod 600 /opt/movo/.env.prod
   ```
   Use `openssl rand -hex 24` for `POSTGRES_PASSWORD` (hex keeps the database URL valid) and `openssl rand -base64 48` for `JWT_SECRET`.

## 3. First deploy

1. GitHub → repo Settings → Secrets and variables → Actions → add secrets:

   | Secret | Value |
   | --- | --- |
   | `DEPLOY_HOST` | VM public IP |
   | `DEPLOY_USER` | `ubuntu` |
   | `DEPLOY_SSH_KEY` | contents of `~/.ssh/movo_deploy` |
   | `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan <vm-ip>` (recommended) |
   | `GHCR_PULL_TOKEN` | only if the GHCR package stays private: a classic token with `read:packages` |

   Optional variable `DEPLOY_PATH` (default `/opt/movo`).
2. Actions → **Deploy** → Run workflow. It builds the image for arm64 and amd64 on native runners, pushes `ghcr.io/tejas96/movo-api:<sha>` and `:latest`, copies the compose files and backup scripts to the VM, runs `docker compose pull && up -d`, and waits for the API to report healthy. After that, every push to `main` that passes CI deploys by itself.
3. First image only: GitHub → your profile → Packages → `movo-api` → Package settings → change visibility to **Public** (the image holds no secrets), or set `GHCR_PULL_TOKEN`.
4. Create the platform admin (reads `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` from `.env.prod`):
   ```bash
   cd /opt/movo
   alias dc='docker compose -f docker-compose.prod.yml --env-file .env.prod'
   dc exec api node dist/cli/seed.js
   ```
   Do not pass `--demo` on production.
5. Check: `curl https://api.<domain>/health`.

Useful commands on the VM (with the `dc` alias above): `dc ps`, `dc logs -f api`, `dc restart api`, `dc pull && dc up -d`.

Without GitHub Actions you can build and run on the VM directly: `git clone` the repo, `docker build -f apps/api/Dockerfile -t movo-api .`, set `API_IMAGE=movo-api` in `.env.prod`, then `dc up -d`.

Rollback: set `API_IMAGE=ghcr.io/tejas96/movo-api:<older-sha>` in `.env.prod` and `dc up -d api`. Migrations only move forward, so roll back only to an image that knows the current schema.

## 4. Backups

The `backup` container runs `backup.sh` every day at **02:30 IST**:

- `pg_dump` in custom format, gzipped, into `/opt/movo/backups/daily/`. Each dump is checked with `gzip -t` and `pg_restore --list`.
- The first dump of each month is also copied to `backups/monthly/`.
- Keeps 14 daily and 6 monthly (`KEEP_DAILY`, `KEEP_MONTHLY`).
- Off-site copy with rclone when `RCLONE_REMOTE` is set. For Cloudflare R2: create a bucket and an R2 API token (Object Read & Write on that bucket), then set `RCLONE_REMOTE=r2:<bucket>`, `RCLONE_S3_ACCESS_KEY_ID`, `RCLONE_S3_SECRET_ACCESS_KEY`, `RCLONE_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`. Any S3-compatible store works (set `RCLONE_S3_PROVIDER`). Off-site copies follow the same retention by age.
- Pings `BACKUP_HEARTBEAT_URL` on success and `<url>/fail` on failure.

Run one now: `dc exec backup backup.sh`.

### Monthly restore drill

On the first Sunday of the month:

```bash
dc exec backup restore.sh                    # newest daily -> scratch db movo_restore_drill
dc exec backup restore.sh /backups/monthly/movo-2026-09.dump.gz
dc exec postgres psql -U movo -d postgres -c 'DROP DATABASE movo_restore_drill'
```

`restore.sh` prints row counts for migrations, users, societies and memberships. Compare them with the live database. It refuses to restore into `movo`, `movo_test` or the live database name.

### Real restore (disaster)

```bash
dc stop api
gunzip -c backups/daily/<file>.dump.gz | dc exec -T postgres pg_restore -U movo -d movo --clean --if-exists --no-owner
dc start api
```

A backup from R2 first: `dc exec backup rclone copy r2:<bucket>/daily/<file> /backups/restore/`.

## 5. Uptime alerts

- **UptimeRobot** → Add monitor → HTTP(s), URL `https://api.<domain>/health`, interval **5 minutes**, keyword `"status":"ok"` if you use the keyword type. Alert contact: your email (and the UptimeRobot app for push).
- **healthchecks.io** → Add check → period **1 day**, grace **1 hour**, time zone Asia/Kolkata. Put its ping URL in `BACKUP_HEARTBEAT_URL` and run `dc up -d backup`. You get an email when a backup fails or does not run.
- Sentry is not wired in yet. API logs: `dc logs api` (rotated at 5 × 10 MB per container).

## 6. Android release

### Upload key (once)

Play App Signing keeps the real app signing key. You keep an **upload key**. Make it outside the repo and back it up (password manager plus one offline copy). Losing it means asking Google to reset it.

```bash
mkdir -p ~/keys
keytool -genkeypair -v -storetype PKCS12 -keystore ~/keys/movo-upload.keystore \
  -alias movo-upload -keyalg RSA -keysize 2048 -validity 10000
```

Add to `~/.gradle/gradle.properties` (never to the repo):

```properties
MOVO_UPLOAD_STORE_FILE=/Users/<you>/keys/movo-upload.keystore
MOVO_UPLOAD_STORE_PASSWORD=...
MOVO_UPLOAD_KEY_ALIAS=movo-upload
MOVO_UPLOAD_KEY_PASSWORD=...
```

The same names also work as environment variables. Without them, release builds are signed with the debug key and Gradle prints a warning: fine for testing on your phone, rejected by Play.

### Production API URL

Release builds read `apps/mobile/.env.production` (debug builds read `.env`). Create it once; it is gitignored:

```bash
echo "API_URL=https://api.<domain>" > apps/mobile/.env.production
```

The build stops if a release signed with the upload key would not use `https://`. `ENVFILE=<file>` overrides the choice.

### Version

- `versionName` comes from `version` in `apps/mobile/package.json` (override with `MOVO_VERSION_NAME`).
- `versionCode` comes from `MOVO_VERSION_CODE` (default 1). Play needs a higher number for every upload: `MOVO_VERSION_CODE=2 pnpm --filter @movo/mobile android:bundle`, or keep the current number in `~/.gradle/gradle.properties`.
- Also bump `APP_VERSION` in `apps/mobile/src/core/env.ts` and, when an old app must update, `MIN_SUPPORTED_APP_VERSION` / `LATEST_APP_VERSION` in `.env.prod`.

### Build

```bash
pnpm --filter @movo/mobile android:bundle        # AAB for Play: android/app/build/outputs/bundle/release/app-release.aab
pnpm --filter @movo/mobile android:apk-release   # APK to sideload: android/app/build/outputs/apk/release/app-release.apk
```

First build takes about 7 minutes; the AAB is about 60 MB (all four CPU types, Play splits it per device).

## 7. Google Play: internal testing

1. Play Console → Create app: name MOVO, default language English (India), App, Free.
2. **Testing → Internal testing** → Testers: create an email list (you and the committee). Create release → upload `app-release.aab`, accept Play App Signing, add release notes → Save → Review → Roll out. Testers join through the opt-in link.
3. **App content** (Policy → App content), answer once:

   | Form | Answer |
   | --- | --- |
   | Privacy policy | `https://tejas96.github.io/movo/privacy.html` |
   | App access | Restricted. Give a reviewer login: a test society account (phone + password) and notes |
   | Ads | No ads |
   | Content rating | Questionnaire, category "Utility, productivity, communication or other". No violence, sexual content, gambling. Users interact (notices, directory): Yes. Shares location: No. Result is usually "Everyone"/"3+" |
   | Target audience | 18 and over only. Not designed for children |
   | News app | No |
   | Government app | No |
   | Financial features | None (MOVO records payments; it does not move money) |
   | Health | No |
   | Data safety | Table below |
   | Account deletion | In-app path Me → Delete my account, web URL `https://tejas96.github.io/movo/delete-account.html` |

### Data safety answers

General: data is **encrypted in transit** (HTTPS): Yes. Users can **request deletion**: Yes. Collection is **required** for the app to work unless marked optional. No data is **shared** with third parties (processors acting for us do not count as sharing under Play's rules). No data is used for ads or marketing.

| Data type (Play category) | Collected | Purpose | Optional |
| --- | --- | --- | --- |
| Name (Personal info) | Yes | App functionality, Account management | No |
| Email address (Personal info) | Yes | Account management (reset links), App functionality | Yes |
| Phone number (Personal info) | Yes | Account management (sign in), App functionality | No |
| Address: flat and wing (Personal info → Address) | Yes | App functionality | No |
| Other info: vehicle numbers, society role (Personal info → Other) | Yes | App functionality | Yes |
| Photos (profile photo) | Yes | App functionality | Yes |
| Purchase history: maintenance payments recorded by the committee (Financial info → Purchase history) | Yes | App functionality | No |
| Other user-generated content: notices, minutes, tasks, RSVPs (Messages → Other in-app messages / App activity → Other user-generated content) | Yes | App functionality | Yes |
| Device or other IDs: push token | Yes | App functionality (notifications) | No |
| Crash logs / diagnostics | No (server logs only, not collected from the device) | – | – |
| Location, contacts, SMS, call logs, web history, health, files | No | – | – |

If you later add Sentry or analytics, update this table and `site/privacy.html` together.

4. Store listing: short and full description, 512×512 icon, 1024×500 feature graphic, at least 2 phone screenshots. Category: House & Home. Contact email `tejas96patil@gmail.com`.
5. New personal developer accounts must run a **closed test with at least 12 testers for 14 days** before production access. Start that as soon as internal testing looks good.

## 8. Release checklist

Server
- [ ] CI green on `main`, Deploy workflow green, `https://api.<domain>/health` ok
- [ ] `.env.prod`: `JWT_SECRET` and `POSTGRES_PASSWORD` random, `PRIVACY_POLICY_URL` and `SUPPORT_EMAIL` set
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` set (a verified sending domain in Resend), or accept that reset links are only logged
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` set, or accept that push is only logged
- [ ] Platform admin created, society #1 created from the app
- [ ] `dc exec backup backup.sh` ran, restore drill ran, healthchecks.io shows green
- [ ] UptimeRobot monitor active

App
- [ ] `apps/mobile/.env.production` points at `https://api.<domain>`
- [ ] Version name and `MOVO_VERSION_CODE` bumped, `APP_VERSION` matches
- [ ] Release built with the upload key (`keytool -printcert -jarfile app-release.aab` shows your name, not "Android Debug")
- [ ] Installed the release APK on a real phone: sign in, notices, push, delete account
- [ ] Privacy policy page live and matches the Data safety form

Monthly
- [ ] Restore drill (section 4)
- [ ] `sudo apt upgrade` on the VM, `dc pull && dc up -d`
- [ ] Look at disk space: `df -h` and `du -sh /opt/movo/backups`
