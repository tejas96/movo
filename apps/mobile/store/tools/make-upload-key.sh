#!/usr/bin/env bash
# Make the Google Play upload key once and wire it into Gradle.
#
#   apps/mobile/store/tools/make-upload-key.sh
#
# Asks for one password (hidden, twice), creates ~/keys/movo-upload.jks (PKCS12, RSA 4096,
# alias movo-upload, valid about 27 years) and writes the four MOVO_UPLOAD_* lines to
# ~/.gradle/gradle.properties (mode 600). The password never appears on screen or on a
# command line. Stops if the key already exists. Prints the SHA-1 for Firebase at the end.
# Back up the .jks file and the password (password manager plus one offline copy).
set -euo pipefail
KEYSTORE=${MOVO_UPLOAD_STORE_FILE:-$HOME/keys/movo-upload.jks}
ALIAS=movo-upload
PROPS=$HOME/.gradle/gradle.properties

if [ -e "$KEYSTORE" ]; then echo "$KEYSTORE already exists. Not touching it."; exit 1; fi
if [ -f "$PROPS" ] && grep -q '^MOVO_UPLOAD_' "$PROPS"; then
  echo "$PROPS already has MOVO_UPLOAD_* lines. Remove them first if you mean to replace the key."; exit 1
fi

read -r -s -p "Upload key password (at least 8 characters, hidden): " P1; echo
read -r -s -p "Same password again: " P2; echo
[ "$P1" = "$P2" ] || { echo "The two passwords differ. Nothing was made."; exit 1; }
[ ${#P1} -ge 8 ] || { echo "Too short. Nothing was made."; exit 1; }
case "$P1" in *$'\n'*|*\\*) echo "Do not use a backslash in this password. Nothing was made."; exit 1 ;; esac

mkdir -p "$(dirname "$KEYSTORE")" && chmod 700 "$(dirname "$KEYSTORE")"
export MOVO_KS_PASS="$P1"
keytool -genkeypair -noprompt -storetype PKCS12 -keystore "$KEYSTORE" -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=MOVO, O=MOVO, C=IN" \
  -storepass:env MOVO_KS_PASS -keypass:env MOVO_KS_PASS
chmod 600 "$KEYSTORE"

mkdir -p "$(dirname "$PROPS")"; touch "$PROPS"; chmod 600 "$PROPS"
{
  echo ""
  echo "# MOVO Play upload key (apps/mobile/store/tools/make-upload-key.sh)"
  echo "MOVO_UPLOAD_STORE_FILE=$KEYSTORE"
  echo "MOVO_UPLOAD_KEY_ALIAS=$ALIAS"
  printf 'MOVO_UPLOAD_STORE_PASSWORD=%s\n' "$P1"
  printf 'MOVO_UPLOAD_KEY_PASSWORD=%s\n' "$P1"
} >> "$PROPS"

echo "Key: $KEYSTORE"
echo "Gradle: $PROPS (MOVO_UPLOAD_* added)"
echo -n "Upload key SHA-1: "
keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass:env MOVO_KS_PASS \
  | awk '/SHA1:/{print $2; exit}'
unset MOVO_KS_PASS P1 P2
echo "UPLOAD-KEY-DONE"
