# Release and operations

How MOVO goes live and stays up, for ₹0 a month. Production is one **Oracle Cloud "Always Free" ARM VM in Mumbai** (`ap-mumbai-1`) running `infra/docker-compose.prod.yml` (api + postgres + caddy + backup). Fly.io was considered on 2026-09-27 and dropped for cost (see [00-decisions-needed.md](00-decisions-needed.md), decision 2). Everything in the repo works without the accounts below; each piece switches on when its account or secret exists.

**Live setup (2026-10-06)**

| What | Value |
| --- | --- |
| Tenancy | BeyondNyx, home region Mumbai, Pay As You Go (billed in SGD: the contract is with Oracle Singapore). Budget `movo-zero-spend`: SG$1 a month, email at 1 % actual spend |
| VM | `movo-arm`, Ampere VM.Standard.A1.Flex **2 OCPU / 2 GB**, 50 GB boot volume, Ubuntu 24.04 aarch64, 2 GB swap, public IP `92.4.70.154` (ephemeral) |
| Name | `https://movo-society.duckdns.org` (also `92-4-70-154.sslip.io`, same server). The app's release build uses the DuckDNS name |
| Deploy | GitHub secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`; repo variable `DEPLOY_ARCHES=arm64` |
| Backups off-site | Object Storage bucket `movo-backups` (namespace `bmyygakxjg10`), customer secret key `movo-backup-2` |
| Not set up yet | healthchecks.io (`UPTIME_HEARTBEAT_URL`, `BACKUP_HEARTBEAT_URL`), Resend |

The first server (an AMD VM.Standard.E2.1.Micro with 1 GB, used while Ampere was out of capacity) was retired on 2026-10-06 after the data moved with `pg_dump | pg_restore` (section 3, "Moving to a new VM").

If the server IP changes (new VM, terminate and recreate): log in at duckdns.org, type the new IP in the `movo-society` row, **update ip**, then `dc restart caddy` on the new VM so it fetches the certificate at once. Update the `DEPLOY_HOST` and `DEPLOY_KNOWN_HOSTS` secrets too. No app build is needed.

| Piece | Where |
| --- | --- |
| API image | `apps/api/Dockerfile` (multi-arch; runs `prisma migrate deploy`, then the API as `node`) |
| Production stack | `infra/docker-compose.prod.yml`, `infra/Caddyfile`, `infra/.env.prod.example` |
| Backups | `infra/backup/` (`backup.sh`, `restore.sh`, daily scheduler) |
| Deploy | `.github/workflows/deploy.yml` (skipped until the `DEPLOY_*` secrets exist) |
| Privacy policy site | `site/` and `.github/workflows/pages.yml` |
| Android release | `apps/mobile/android/app/build.gradle`, `pnpm --filter @movo/mobile android:bundle` |

Public URLs once live:

- API health: `https://<API_DOMAIN>/health` (returns `{"status":"ok",...}`), for example `https://movo-society.duckdns.org/health`
- Privacy policy: https://tejas96.github.io/movo/privacy.html
- Account deletion: https://tejas96.github.io/movo/delete-account.html

## 1. Accounts to create (one time)

| Account | Cost | Needed for |
| --- | --- | --- |
| Oracle Cloud, home region **India West (Mumbai)** | ₹0, card needed | The VM and (optionally) Object Storage for off-site backups. Upgraded to Pay As You Go (step 2.2); Always Free limits still cost ₹0 |
| DuckDNS (sign in with GitHub or Google) | ₹0 | A free name like `movo-society.duckdns.org` for HTTPS. A bought domain later is better |
| healthchecks.io | ₹0 (20 checks) | Email when the API stops (API heartbeat) or a nightly backup does not run |
| GitHub Pages | ₹0 | Privacy policy. Repo Settings → Pages → Source: **GitHub Actions** |
| Google Play Console | $25 once | Publishing the app |
| Firebase (Spark plan) | ₹0 | Push notifications (FCM) |
| Resend | ₹0 (3,000 emails a month) | Password reset emails (needs a domain you own; until then reset links are only logged and admins issue reset codes) |
| Cloudflare R2 (optional) | ₹0 up to 10 GB | Off-site backups instead of Oracle Object Storage |

The home region cannot be changed later and Always Free compute only runs in the home region, so pick **India West (Mumbai)** at signup.

## 2. Server setup (once, in this order)

### 2.1 Tenancy

1. Sign up at [signup.oraclecloud.com](https://signup.oraclecloud.com): account type Individual, home region **India West (Mumbai)**, card for verification (a small refundable hold). Wait for the "account is ready" email.
2. Enable MFA on your Oracle login (Profile → My profile → Multi-factor authentication).

### 2.2 Upgrade to Pay As You Go (why: reclaim)

On a free-tier-only account Oracle reclaims Always Free compute instances that sit idle (low CPU, network and memory over 7 days). MOVO is idle most of the day, so it would be stopped. **Pay As You Go accounts are not reclaimed**, and Always Free resources stay free on them.

1. Console → ☰ → Billing & Cost Management → **Upgrade and Manage Payment** → Upgrade to Pay As You Go → confirm the card. It takes minutes to a day; wait for the email.
2. Guard rail: Billing & Cost Management → **Budgets** → Create budget: target the root compartment, amount ₹100 per month, alert rule at 1 % of actual spend to your email. Any charge means something outside Always Free was created.
3. Create only what this runbook lists. Everything below is inside Always Free: Ampere A1 up to 4 OCPU / 24 GB total, block volumes up to 200 GB total, Object Storage 10 GB (plus 10 GB Archive), 10 TB outbound traffic a month.

### 2.3 SSH key (on your Mac)

```bash
ssh-keygen -t ed25519 -f ~/.ssh/movo_oracle -C movo-oracle      # admin key; set a passphrase
cat ~/.ssh/movo_oracle.pub                                       # paste this in step 2.4
```

### 2.4 Network and VM

1. Console → ☰ → Compute → Instances → **Create instance**. Compartment: root (or one you make for MOVO).
2. Name `movo`. Placement: Mumbai has one availability domain (AD-1); leave the fault domain on "Let Oracle choose".
3. Image and shape:
   - Image → Change image → **Canonical Ubuntu 24.04** (the plain one, not "Minimal"); the aarch64 build is picked automatically for Ampere.
   - Shape → Change shape → Ampere → **VM.Standard.A1.Flex**, **2 OCPU, 2 GB** memory (what runs today: the stack uses about 300 MB). Up to 4 OCPU / 24 GB is still free, so raise memory later with Instance → Edit → shape if needed. Burstable off.
4. Networking: **Create new virtual cloud network** and **Create new public subnet** (the wizard makes the VCN, internet gateway, route table and a default security list), **Assign a public IPv4 address**: yes.
5. SSH keys: **Paste public keys** → the `movo_oracle.pub` line.
6. Boot volume: the default 50 GB is plenty (free up to 200 GB total across all boot and block volumes). The cost estimate in the wizard shows a list price for the boot volume (about $3 a month); it ignores the free tier, the real charge is 0. Leave encryption on the Oracle-managed key.
7. Create. When it is Running, note the **Public IP** on the instance page. The ephemeral IP stays with the instance across stop and start; it is only released if the instance is terminated.

**"Out of host capacity"**: Ampere capacity in Mumbai runs out at times. Retry the same Create a few hours later (early morning IST works best), try a specific fault domain instead of "Let Oracle choose", or create with 1 OCPU / 6 GB and resize later (Instance → Edit → shape). Pay As You Go accounts get capacity more easily than free-tier ones, which is another reason to do step 2.2 first.

### 2.5 Open ports 80 and 443

Two firewalls, both needed.

1. Oracle security list: Instance → Primary VNIC → Subnet → **Security** (or Security Lists) → Default Security List → Add Ingress Rules:
   - Source CIDR `0.0.0.0/0`, TCP, destination port `80`
   - Source CIDR `0.0.0.0/0`, TCP, destination port `443`
   - Optional: Source CIDR `0.0.0.0/0`, UDP, destination port `443` (HTTP/3)
   
   Port 22 is already open from `0.0.0.0/0` in the default list. You can narrow it to your own IP (`<your-ip>/32`), but GitHub Actions deploys over SSH from changing IPs, so leave it open and rely on key-only SSH (2.8).
2. Ubuntu host firewall. Oracle's Ubuntu images ship iptables rules that end the INPUT chain with a REJECT (rule 6), so 80 and 443 stay blocked until you insert rules before it. SSH in first:
   ```bash
   ssh -i ~/.ssh/movo_oracle ubuntu@<public-ip>
   sudo iptables -L INPUT --line-numbers          # rule 6 is the REJECT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p udp --dport 443 -j ACCEPT   # optional, HTTP/3
   sudo netfilter-persistent save                  # survives reboots
   ```
   Do not install or enable `ufw` on top of this; it fights the Oracle rules.

### 2.6 Base system

```bash
sudo timedatectl set-timezone Asia/Kolkata
sudo apt update && sudo apt -y full-upgrade
sudo apt -y install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades     # answer Yes: security updates install daily
sudo reboot                                         # if /var/run/reboot-required exists
```

Swap (2 GB), so a memory spike slows the VM instead of killing a container:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-movo.conf && sudo sysctl --system
```

### 2.7 Docker Engine and the compose plugin (Docker's apt repo)

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker                 # starts on boot, so the stack comes back after a reboot
sudo usermod -aG docker ubuntu                     # log out and back in
docker compose version
```

Being in the `docker` group is root-equivalent; only the `ubuntu` user (your key and the deploy key) is in it.

### 2.8 SSH hardening and the deploy key

Oracle images already disable password login; make it explicit:

```bash
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin no\n' \
  | sudo tee /etc/ssh/sshd_config.d/99-movo.conf
sudo systemctl reload ssh
```

A separate key for GitHub Actions (on your Mac, no passphrase):

```bash
ssh-keygen -t ed25519 -N "" -C movo-deploy -f ~/.ssh/movo_deploy
ssh-copy-id -i ~/.ssh/movo_deploy.pub -o IdentityFile=~/.ssh/movo_oracle ubuntu@<public-ip>
ssh-keyscan <public-ip>          # output goes in DEPLOY_KNOWN_HOSTS
```

### 2.9 Name for HTTPS

Free option: [duckdns.org](https://www.duckdns.org) → sign in → add a subdomain, for example `movo-society` → set **current ip** to the VM's public IP → update ip. `movo-society.duckdns.org` now points at the VM and Caddy can get a Let's Encrypt certificate for it. Check from your Mac: `dig +short movo-society.duckdns.org` prints the IP.

Later, a bought domain is better (your own name, a verified sending domain for Resend, no dependence on DuckDNS): add an `A` record `api.<domain>` → the public IP (in Cloudflare keep it **DNS only**, grey cloud), set `API_DOMAIN=api.<domain>` in `.env.prod`, `dc up -d caddy`, and ship an app build pointing at the new name (section 6).

### 2.10 App folder and settings

```bash
sudo mkdir -p /opt/movo/backup /opt/movo/backups && sudo chown -R ubuntu:ubuntu /opt/movo
```

From your Mac, copy the stack (the deploy workflow also copies these on every deploy):

```bash
scp -i ~/.ssh/movo_oracle infra/docker-compose.prod.yml infra/Caddyfile ubuntu@<public-ip>:/opt/movo/
scp -i ~/.ssh/movo_oracle infra/backup/Dockerfile infra/backup/*.sh ubuntu@<public-ip>:/opt/movo/backup/
scp -i ~/.ssh/movo_oracle infra/.env.prod.example ubuntu@<public-ip>:/opt/movo/.env.prod
```

On the VM, fill in `/opt/movo/.env.prod` (`nano /opt/movo/.env.prod`), then `chmod 600 /opt/movo/.env.prod`:

- `API_DOMAIN`: `movo-society.duckdns.org` (or `api.<domain>`), `ACME_EMAIL`: your email.
- `POSTGRES_PASSWORD`: `openssl rand -hex 24` (hex keeps the database URL valid). `JWT_SECRET`: `openssl rand -base64 48`.
- `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD`: for the seed in section 3.
- `UPTIME_HEARTBEAT_URL`, `BACKUP_HEARTBEAT_URL`: section 5. `RCLONE_*`: section 4. `FIREBASE_SERVICE_ACCOUNT_JSON`: section 6. All can be filled later.

Layout on the VM: `/opt/movo/{docker-compose.prod.yml, Caddyfile, .env.prod, backup/, backups/}`. Database, photos and certificates live in Docker volumes (`movo_pgdata`, `movo_files`, `movo_caddy_data`).

## 3. First deploy

1. GitHub → repo Settings → Secrets and variables → Actions → add secrets:

   | Secret | Value |
   | --- | --- |
   | `DEPLOY_HOST` | VM public IP |
   | `DEPLOY_USER` | `ubuntu` |
   | `DEPLOY_SSH_KEY` | contents of `~/.ssh/movo_deploy` (the private key) |
   | `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan <public-ip>` (recommended; without it the host key is trusted on first use) |
   | `GHCR_PULL_TOKEN` | optional: by default the VM logs in to GHCR with the run's own token for the pull and logs out after, so the package may be private or public |

   Optional variables: `DEPLOY_ARCHES` (image platforms: default `amd64`; set `arm64` for the Ampere VM, `amd64 arm64` during a move between the two), `DEPLOY_PATH` (default `/opt/movo`), `DEPLOY_PORT` secret (default 22), `ARM_RUNNER` (default `ubuntu-24.04-arm`, free for public repos; on a private repo set `ubuntu-latest` and arm64 is built under QEMU, slower).
2. Actions → **Deploy** → Run workflow. It builds the image for the platforms in `DEPLOY_ARCHES` on native runners, pushes `ghcr.io/tejas96/movo-api:<sha>` and `:latest`, copies the compose files and backup scripts to the VM, runs `docker compose pull`, `docker compose up -d`, and waits for the API to report healthy. Without the secrets every job is skipped. After this, every push to `main` that passes CI deploys by itself.
3. The `movo-api` package on GHCR is public today (the image holds no secrets); anyone can pull it, which also makes a manual `dc pull` on the VM work without a login.
4. Caddy fetches the certificate on the first request; watch `dc logs caddy` for `certificate obtained successfully`.
5. Create the platform admin (reads `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` from `.env.prod`). The seed is built to `/app/dist/cli/seed.js` in the image and the container's working directory is `/app`:
   ```bash
   cd /opt/movo
   alias dc='docker compose -f docker-compose.prod.yml --env-file .env.prod'   # add to ~/.bashrc
   dc exec -u node api node dist/cli/seed.js
   ```
   Do not pass `--demo` on production. It is safe to run again.
6. Check from your Mac: `curl https://movo-society.duckdns.org/health`.

Useful commands on the VM (with the `dc` alias above): `dc ps`, `dc logs -f api`, `dc restart api`, `dc pull && dc up -d`.

Migrations run when the api container starts (`prisma migrate deploy`, then the API). The container starts as root only to hand the `files` volume to the `node` user, then drops to `node`.

Without GitHub Actions you can build and run on the VM directly (it is ARM, so the native build is arm64): `git clone` the repo, `docker build -f apps/api/Dockerfile -t movo-api .`, set `API_IMAGE=movo-api` in `.env.prod`, then `dc up -d`.

Moving to a new VM (done once, AMD → Ampere, 2026-10-06): set up the new VM (2.4–2.8), copy the compose files and `.env.prod` (`ssh old 'cat /opt/movo/.env.prod' | ssh new 'umask 077; cat > /opt/movo/.env.prod'`), set `API_DOMAIN` for the new IP, `dc pull` and start `postgres`. Then `dc stop api backup` on the old VM and stream the data across:

```bash
ssh old "cd /opt/movo && dc exec -T postgres sh -c 'pg_dump -U \$POSTGRES_USER -d \$POSTGRES_DB -Fc'" \
  | ssh new "cd /opt/movo && dc exec -T postgres sh -c 'pg_restore -U \$POSTGRES_USER -d \$POSTGRES_DB --no-owner --exit-on-error'"
```

Copy the `movo_files` volume the same way (`tar` through a throwaway container), compare row counts (the query in `restore.sh`), `dc up -d` on the new VM, test it on its sslip.io name, then move DuckDNS and the deploy secrets (top of this file).

Rollback: set `API_IMAGE=ghcr.io/tejas96/movo-api:<older-sha>` in `.env.prod` and `dc up -d api`. Migrations only move forward, so roll back only to an image that knows the current schema.

## 4. Backups

The `backup` container runs `backup.sh` every day at **02:30 IST**:

- `pg_dump` in custom format, gzipped, into `/opt/movo/backups/daily/`. Each dump is checked with `gzip -t` and `pg_restore --list`.
- The first dump of each month is also copied to `backups/monthly/`.
- Keeps 14 daily and 6 monthly (`KEEP_DAILY`, `KEEP_MONTHLY`).
- Market photos are mirrored into `backups/files/` (new files copied, nothing deleted).
- Off-site copy with rclone when `RCLONE_REMOTE` is set: dumps and photos. Off-site copies follow the same retention by age.
- Pings `BACKUP_HEARTBEAT_URL` on success and `<url>/fail` on failure.

Run one now: `dc exec backup backup.sh`.

### Off-site: Oracle Object Storage (recommended, Always Free 10 GB Standard, stays in Mumbai)

1. Namespace: Console → Profile → **Tenancy: <name>** → Object storage namespace (a short random string).
2. Bucket: ☰ → Storage → Buckets → compartment **root** (the S3 endpoint creates and finds buckets there by default) → Create bucket `movo-backups`, Standard tier, no public access.
3. Keys: Profile → My profile → **Customer secret keys** → Generate secret key, name `movo-backup`. Copy the secret now (shown once); the **Access key** is the 40-character ID in the list (two different values). A new key can answer 403 for a minute or two before it works everywhere. If a secret is ever pasted where others can see it, generate a new key, put it in `.env.prod`, `dc up -d backup`, run a backup, then delete the old key.
4. In `/opt/movo/.env.prod`:
   ```
   RCLONE_REMOTE=offsite:movo-backups
   RCLONE_S3_PROVIDER=Other
   RCLONE_S3_ACCESS_KEY_ID=<access key>
   RCLONE_S3_SECRET_ACCESS_KEY=<secret key>
   RCLONE_S3_ENDPOINT=https://<namespace>.compat.objectstorage.ap-mumbai-1.oraclecloud.com
   RCLONE_S3_REGION=ap-mumbai-1
   RCLONE_S3_FORCE_PATH_STYLE=true
   ```
5. `dc up -d backup`, then `dc exec backup rclone lsd offsite:` (lists `movo-backups`) and `dc exec backup backup.sh` (ends with `done`). The bucket now has `daily/`, `monthly/` and `files/`.

### Off-site: Cloudflare R2 (alternative, 10 GB free)

Create a bucket and an R2 API token (Object Read & Write on that bucket), then:

```
RCLONE_REMOTE=offsite:<bucket>
RCLONE_S3_PROVIDER=Cloudflare
RCLONE_S3_ACCESS_KEY_ID=<token access key id>
RCLONE_S3_SECRET_ACCESS_KEY=<token secret>
RCLONE_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
RCLONE_S3_REGION=auto
```

R2 stores data outside India; if you use it, the privacy policy already names it.

### Monthly restore drill

On the first Sunday of the month:

```bash
dc exec backup restore.sh                    # newest daily -> scratch db movo_restore_drill
dc exec backup restore.sh /backups/monthly/movo-2026-09.dump.gz
dc exec postgres psql -U movo -d postgres -c 'DROP DATABASE movo_restore_drill'
```

`restore.sh` prints row counts for migrations, users, societies and memberships. Compare them with the live database. It refuses to restore into `movo`, `movo_test` or the live database name. Once a quarter, also pull one dump from off-site (below) and restore that, so the off-site copy is proven too.

### Real restore (disaster)

Same VM:

```bash
dc stop api
gunzip -c backups/daily/<file>.dump.gz | dc exec -T postgres pg_restore -U movo -d movo --clean --if-exists --no-owner
dc start api
```

A backup from off-site first: `dc exec backup rclone copy offsite:movo-backups/daily/<file> /backups/restore/`. Photos: `dc exec backup rclone copy offsite:movo-backups/files /backups/files`, then copy them into the volume (`docker run --rm -v movo_files:/data/files -v /opt/movo/backups/files:/src alpine cp -a /src/. /data/files/`).

VM lost: build a new VM with section 2, `dc up -d postgres backup`, pull the newest dump from off-site, restore as above, then run Deploy. About an hour.

## 5. Uptime alerts (healthchecks.io)

No UptimeRobot. healthchecks.io works the other way round: the server pings it, and it emails you when pings stop. Two checks:

1. **API heartbeat.** healthchecks.io → Add check `movo-api`: period **5 minutes**, grace **10 minutes**. Copy its ping URL (`https://hc-ping.com/<uuid>`) into `UPTIME_HEARTBEAT_URL` in `.env.prod`, then `dc up -d api`. Every 5 minutes the API checks that the database answers and pings the URL. No ping means the VM, Docker, the API or the database is down (or the VM lost its network). Empty variable = off.
2. **Backup heartbeat.** Add check `movo-backup`: period **1 day**, grace **1 hour**, time zone Asia/Kolkata. Its URL goes in `BACKUP_HEARTBEAT_URL`, then `dc up -d backup`. You get an email when a backup fails or does not run.

Integrations → Email is on by default for your account email; add the healthchecks.io phone app or Telegram if you want push. The heartbeat does not see Caddy or the certificate; after a DuckDNS or DNS change, `curl https://<API_DOMAIN>/health` yourself.

Sentry is not wired in yet. API logs: `dc logs api` (rotated at 5 × 10 MB per container).

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
echo "API_URL=https://<API_DOMAIN>" > apps/mobile/.env.production
# for example: echo "API_URL=https://movo-society.duckdns.org" > apps/mobile/.env.production
```

Use exactly the `API_DOMAIN` from `/opt/movo/.env.prod`, with `https://` and no trailing slash, and check `curl https://<API_DOMAIN>/health` first. `build.gradle` reads `API_URL=` from that file (through react-native-config) and bakes it into the release build; the app has no way to change it later, so moving from DuckDNS to a bought domain means a new build (keep the DuckDNS name pointing at the VM until old installs have updated; `MIN_SUPPORTED_APP_VERSION` can force that).

The build stops if a release signed with the upload key would not use `https://`. `ENVFILE=<file>` overrides the choice.

### Version

- `versionName` comes from `version` in `apps/mobile/package.json` (override with `MOVO_VERSION_NAME`).
- `versionCode` comes from `MOVO_VERSION_CODE` (default 1). Play needs a higher number for every upload: `MOVO_VERSION_CODE=2 pnpm --filter @movo/mobile android:bundle`, or keep the current number in `~/.gradle/gradle.properties`.
- Also bump `APP_VERSION` in `apps/mobile/src/core/env.ts` and, when an old app must update, `MIN_SUPPORTED_APP_VERSION` / `LATEST_APP_VERSION` in `.env.prod` (then `dc up -d api`).

### Build

```bash
pnpm --filter @movo/mobile android:bundle        # AAB for Play: android/app/build/outputs/bundle/release/app-release.aab
pnpm --filter @movo/mobile android:apk-release   # APK to sideload: android/app/build/outputs/apk/release/app-release.apk
```

First build takes about 7 minutes; the AAB is about 60 MB (all four CPU types, Play splits it per device).

### Firebase (push)

The code is ready and runs without Firebase: with no `google-services.json` the Gradle plugin is skipped and the app never touches Firebase; with no `FIREBASE_SERVICE_ACCOUNT_JSON` the API logs each push and marks it `SKIPPED`. Two things turn push on, and they are independent: the file in the app (phones get a token and register it) and the secret on the API (the server sends).

1. [console.firebase.google.com](https://console.firebase.google.com) → **Create a project** → name `MOVO` → **Google Analytics: off** (the privacy policy promises no analytics) → Create. The free Spark plan is enough; FCM has no per-message cost.
2. Project overview → **Add app → Android**:
   - Android package name: `com.movo.app` (must match exactly).
   - App nickname: `MOVO Android`.
   - Debug signing certificate SHA-1: optional for push (FCM does not check it), but add it now so later Google sign-in or App Check work. The repo's debug key:
     ```bash
     keytool -list -v -keystore apps/mobile/android/app/debug.keystore \
       -alias androiddebugkey -storepass android -keypass android | grep SHA1
     # SHA1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
     ```
   - Register app → **Download google-services.json** → put it at `apps/mobile/android/app/google-services.json`. Skip the console's "add the SDK" steps; Gradle is already set up (`com.google.gms.google-services` 4.5.0, applied only when that file exists).
3. Add the other SHA-1s afterwards (Project settings → General → Your apps → MOVO Android → **Add fingerprint**):
   - Upload key: `keytool -list -v -keystore ~/keys/movo-upload.keystore -alias movo-upload | grep SHA1` (asks for the store password).
   - Play App Signing key, once the first AAB is uploaded: Play Console → Test and release → Setup → **App signing** → "App signing key certificate" → SHA-1.
   A new fingerprint does not change `google-services.json`, so no rebuild is needed for push.
4. Commit `google-services.json`. It is app configuration, not a secret (its API key only identifies the Firebase project). If GitHub's secret scanning flags it, close the alert as "used in tests / false positive", and optionally restrict that key in Google Cloud console → APIs & Services → Credentials to Android apps with package `com.movo.app` and the SHA-1s above.
5. Service account key for the API: Firebase console → ⚙ Project settings → **Service accounts** → Firebase Admin SDK → **Generate new private key** → Generate key. A JSON file downloads (named like `movo-xxxxx-firebase-adminsdk-....json`). This one **is a secret**: it can send pushes to every user. Move it out of Downloads, never into the repo (`.gitignore` also blocks `*-firebase-adminsdk-*.json`):
   ```bash
   mkdir -p ~/keys && mv ~/Downloads/movo-*-firebase-adminsdk-*.json ~/keys/firebase-service-account.json
   jq -c . ~/keys/firebase-service-account.json | wc -l       # 1: the whole key on one line
   jq -r .project_id ~/keys/firebase-service-account.json     # your Firebase project id, e.g. movo-1a2b3
   # append it to .env.prod on the VM, in single quotes, without echoing it to the terminal:
   printf "FIREBASE_SERVICE_ACCOUNT_JSON='%s'\n" "$(jq -c . ~/keys/firebase-service-account.json)" \
     | ssh -i ~/.ssh/movo_oracle ubuntu@<public-ip> 'cat >> /opt/movo/.env.prod'
   ```
   `.env.prod.example` already has an empty `FIREBASE_SERVICE_ACCOUNT_JSON=` line: delete that one (`nano /opt/movo/.env.prod`) so only the new line is left, then `dc up -d api`. The API restarts and logs `FCM push enabled for project <project id>`. A value that is not a service account logs a warning and push stays off. Locally, put the same one-line JSON after `FIREBASE_SERVICE_ACCOUNT_JSON=` in `apps/api/.env` (single quotes around it).
6. Build and install the app again (`pnpm --filter @movo/mobile android`, or a new AAB). Sign in, open the app with a society: Android 13+ asks once for notification permission, then the phone registers its token (`POST /v1/me/devices`; one `DeviceToken` row per phone).
7. Test: publish a notice from another account, or raise an emergency alert. Within 30 seconds (the delivery job's interval) the phone shows it; emergency alerts use the "Emergency alerts" channel (high importance, sound). Or send one from the console: Messaging → New campaign → Notifications → "Send test message" with the token (a debug build prints it in Metro as a `[push] token ...` warning).

What the API does with FCM answers: `UNREGISTERED` (app removed, token rotated) or "not a valid FCM registration token" deletes that `DeviceToken`; 429, 5xx and network errors keep the delivery `PENDING` for the next run, up to 5 attempts, then `FAILED`; anything else is `FAILED` with the error in `NotificationDelivery.lastError`.

To rotate the key: generate a new one (step 5), replace the line in `.env.prod` and `dc up -d api`, then delete the old key in Google Cloud console → IAM → Service accounts → firebase-adminsdk → Keys.

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
| Phone number (Personal info) | Yes | Account management (sign in), App functionality | Yes (email alone also works) |
| Address: flat and wing (Personal info → Address) | Yes | App functionality | No |
| Other info: vehicle numbers, society role (Personal info → Other) | Yes | App functionality | Yes |
| Photos (market listing photos the user picks; no profile photo upload yet) | Yes | App functionality | Yes |
| Purchase history: maintenance payments recorded by the committee (Financial info → Purchase history) | Yes | App functionality | No |
| Other user-generated content: notices, minutes, tasks, RSVPs, market listings and reviews (App activity → Other user-generated content) | Yes | App functionality | Yes |
| In-app messages between buyer and seller on a market order (Messages → Other in-app messages) | Yes | App functionality | Yes |
| Device or other IDs: push token | Yes | App functionality (notifications) | No |
| App info and performance / other: IP address and device name on sign-in sessions and the audit log | Yes | Fraud prevention, security | No |
| Crash logs / diagnostics | No (server logs only, not collected from the device) | – | – |
| Location, contacts, SMS, call logs, web history, health, files | No | – | – |

Market photos live in the `files` Docker volume (`FILES_DIR=/data/files`); the backup service mirrors them into `backups/files` every night and copies them off-site when rclone is set.

If you later add Sentry or analytics, update this table and `site/privacy.html` together.

4. Store listing: short and full description, 512×512 icon, 1024×500 feature graphic, at least 2 phone screenshots. Category: House & Home. Contact email `tejas96patil@gmail.com`.
5. New personal developer accounts must run a **closed test with at least 12 testers for 14 days** before production access. Start that as soon as internal testing looks good.

## 8. Release checklist

Server
- [ ] Budget alert set; account shows **Pay As You Go**
- [ ] CI green on `main`, Deploy workflow green, `https://<API_DOMAIN>/health` ok
- [ ] `.env.prod`: `JWT_SECRET` and `POSTGRES_PASSWORD` random, `PRIVACY_POLICY_URL` and `SUPPORT_EMAIL` set, `chmod 600`
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` set (a verified sending domain in Resend), or accept that reset links are only logged
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` set, or accept that push is only logged
- [ ] Platform admin created, society #1 created from the app
- [ ] `dc exec backup backup.sh` ran, off-site bucket has the dump, restore drill ran
- [ ] healthchecks.io: `movo-api` and `movo-backup` both green
- [ ] `sudo reboot` once: the stack comes back by itself and the API heartbeat resumes

App
- [ ] `apps/mobile/.env.production` has `API_URL=https://<API_DOMAIN>`
- [ ] Version name and `MOVO_VERSION_CODE` bumped, `APP_VERSION` matches
- [ ] Release built with the upload key (`keytool -printcert -jarfile app-release.aab` shows your name, not "Android Debug")
- [ ] Installed the release APK on a real phone: sign in, notices, push, delete account
- [ ] Privacy policy page live and matches the Data safety form (data stored in India, Oracle Cloud Mumbai)

Monthly
- [ ] Restore drill (section 4)
- [ ] `dc pull && dc up -d` for new Postgres and Caddy patch images; `ls /var/run/reboot-required` and reboot at a quiet hour if it exists (security updates install by themselves)
- [ ] Disk: `df -h /` and `du -sh /opt/movo/backups`; Object Storage bucket size under 10 GB
- [ ] Billing: Cost Analysis shows ₹0

## 9. Cost

| Item | Monthly |
| --- | --- |
| Ampere A1 VM, 2 OCPU / 2 GB, 50 GB boot volume (Always Free) | ₹0 |
| Object Storage, a few hundred MB of dumps and photos (Always Free 10 GB) | ₹0 |
| Outbound traffic (Always Free 10 TB) | ₹0 |
| DuckDNS, Let's Encrypt, healthchecks.io, GitHub Actions and GHCR (public), Firebase Spark, Resend free | ₹0 |
| **Total** | **₹0** (Play Console $25 once; a bought domain about ₹800–1,000 a year, optional) |
