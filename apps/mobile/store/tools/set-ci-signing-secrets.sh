#!/usr/bin/env bash
# Give GitHub Actions the Play upload key so .github/workflows/release-android.yml can sign.
#
#   apps/mobile/store/tools/set-ci-signing-secrets.sh
#
# Asks for the upload key password (hidden), checks it against the keystore, then sets the
# repo secrets ANDROID_UPLOAD_KEYSTORE_BASE64, MOVO_UPLOAD_STORE_PASSWORD and
# MOVO_UPLOAD_KEY_PASSWORD with `gh secret set` (values go over stdin, never the command line).
# Needs `gh` logged in with access to the repo.
set -euo pipefail
REPO=${MOVO_REPO:-tejas96/movo}
KEYSTORE=${MOVO_UPLOAD_STORE_FILE:-$HOME/keys/movo-upload.jks}
ALIAS=movo-upload

[ -f "$KEYSTORE" ] || { echo "No keystore at $KEYSTORE"; exit 1; }
read -r -s -p "Upload key password (hidden): " P; echo
export MOVO_KS_PASS="$P"
if ! keytool -list -keystore "$KEYSTORE" -alias "$ALIAS" -storepass:env MOVO_KS_PASS >/dev/null 2>&1; then
  unset MOVO_KS_PASS P; echo "Wrong password for $KEYSTORE. Nothing was set."; exit 1
fi
base64 < "$KEYSTORE" | tr -d '\n' | gh secret set ANDROID_UPLOAD_KEYSTORE_BASE64 -R "$REPO"
printf '%s' "$P" | gh secret set MOVO_UPLOAD_STORE_PASSWORD -R "$REPO"
printf '%s' "$P" | gh secret set MOVO_UPLOAD_KEY_PASSWORD -R "$REPO"
unset MOVO_KS_PASS P
gh secret list -R "$REPO" | grep -E 'ANDROID_UPLOAD|MOVO_UPLOAD'
echo "CI-SIGNING-DONE"
