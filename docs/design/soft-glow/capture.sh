#!/usr/bin/env bash
# Renders each mockup screen with headless Chrome and saves the reference PNGs in ./ref.
# Size matches a 390 x 844 pt phone (iPhone 12 to 14) at 3x, the size we compare the app against.
#   ref/<Screen>.png       what the phone shows first (390 x 844 pt)
#   ref/<Screen>-full.png  the whole scrolling page (390 pt wide)
# Usage: docs/design/soft-glow/capture.sh            (all screens)
#        docs/design/soft-glow/capture.sh Main Money  (some screens)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
screens=("$@")
if [ ${#screens[@]} -eq 0 ]; then
  screens=(Join Main Notices Login Money Members Event Emergency Me Theme)
fi

shoot() { # name width height query
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --force-device-scale-factor=3 --window-size="$2,$3" --virtual-time-budget=6000 \
    --screenshot="$here/ref/$1.png" "file://$here/viewer.html?still=1&$4" >/dev/null 2>&1
  echo "ref/$1.png"
}

mkdir -p "$here/ref"
for s in "${screens[@]}"; do
  if [ "$s" = "Theme" ]; then
    shoot Theme 880 1100 "f=Theme"
  else
    shoot "$s" 390 844 "f=$s"
    shoot "$s-full" 390 1900 "f=$s&full=1"
  fi
done
