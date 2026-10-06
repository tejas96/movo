#!/usr/bin/env bash
# Build the Play upload (signed AAB) from a clean checkout of origin/main, never from the
# working folder (which may hold another session's unsaved work).
#
#   apps/mobile/store/tools/build-release.sh <versionCode> [ref]
#
# versionCode must be higher than every upload so far (Play rejects repeats). ref defaults
# to origin/main. Uses apps/mobile/.env.production and the MOVO_UPLOAD_* lines in
# ~/.gradle/gradle.properties (make-upload-key.sh). Output, outside the repo:
#   ../movo-builds/movo-v<versionName>-code<versionCode>-<sha>.aab (+ .sha256)
set -euo pipefail
CODE=${1:?usage: build-release.sh <versionCode> [ref]}
REF=${2:-origin/main}
ROOT=$(git rev-parse --show-toplevel)
OUT=$(dirname "$ROOT")/movo-builds
WT=$(dirname "$ROOT")/movo-release-build

[ -f "$ROOT/apps/mobile/.env.production" ] || { echo "apps/mobile/.env.production is missing"; exit 1; }
grep -q '^MOVO_UPLOAD_STORE_FILE=' "$HOME/.gradle/gradle.properties" 2>/dev/null \
  || { echo "No upload key in ~/.gradle/gradle.properties (run make-upload-key.sh)"; exit 1; }

git -C "$ROOT" fetch -q origin
SHA=$(git -C "$ROOT" rev-parse --short "$REF")
git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || true
git -C "$ROOT" worktree add --detach "$WT" "$REF" >/dev/null
trap 'git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true' EXIT

cp "$ROOT/apps/mobile/.env.production" "$WT/apps/mobile/"
[ -f "$ROOT/apps/mobile/android/local.properties" ] && cp "$ROOT/apps/mobile/android/local.properties" "$WT/apps/mobile/android/"

echo "== install ($SHA)"
(cd "$WT" && pnpm install --frozen-lockfile >/dev/null)
echo "== bundleRelease (versionCode $CODE)"
(cd "$WT/apps/mobile/android" && MOVO_VERSION_CODE=$CODE ./gradlew bundleRelease -q)

AAB=$WT/apps/mobile/android/app/build/outputs/bundle/release/app-release.aab
OWNER=$(keytool -printcert -jarfile "$AAB" 2>/dev/null | awk -F': ' '/Owner:/{print $2; exit}')
case "$OWNER" in *Debug*|"") echo "Signed with '$OWNER', not the upload key. Stopping."; exit 1 ;; esac
VERSION=$(node -p "require('$WT/apps/mobile/package.json').version")
NAME=movo-v$VERSION-code$CODE-$SHA.aab
mkdir -p "$OUT"
cp "$AAB" "$OUT/$NAME"
(cd "$OUT" && shasum -a 256 "$NAME" > "$NAME.sha256")
echo "== done: $OUT/$NAME"
echo "   signer: $OWNER"
grep -h 'API_URL' "$WT/apps/mobile/android/app/build/generated/source/buildConfig/release/com/movo/app/BuildConfig.java" | sed 's/^ */   /'
