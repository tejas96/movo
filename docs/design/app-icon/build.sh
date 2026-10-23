#!/usr/bin/env bash
# Renders the icon SVGs and writes the Android mipmaps and the iOS AppIcon set. See README.md.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for name in icon background foreground monochrome; do
  printf '<!doctype html><html><body style="margin:0;background:transparent"><img src="file://%s/%s.svg" style="width:1024px;height:1024px;display:block"></body></html>' \
    "$here" "$name" > "$tmp/$name.html"
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --default-background-color=00000000 --window-size=1024,1024 \
    --screenshot="$tmp/$name.png" "file://$tmp/$name.html" 2>/dev/null
done

python3 - "$tmp" "$repo" <<'PY'
import json, os, sys
from PIL import Image, ImageDraw
tmp, repo = sys.argv[1], sys.argv[2]
src = {n: Image.open(f'{tmp}/{n}.png').convert('RGBA') for n in ('icon', 'background', 'foreground', 'monochrome')}

def sized(img, px):
    return img.resize((px, px), Image.LANCZOS)

def masked(img, px, shape):
    big = 1024
    mask = Image.new('L', (big, big), 0)
    d = ImageDraw.Draw(mask)
    if shape == 'circle':
        d.ellipse((0, 0, big - 1, big - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, big - 1, big - 1), radius=int(big * 0.22), fill=255)
    out = img.copy()
    out.putalpha(mask)
    return sized(out, px)

res = f'{repo}/apps/mobile/android/app/src/main/res'
for folder, scale in (('mdpi', 1), ('hdpi', 1.5), ('xhdpi', 2), ('xxhdpi', 3), ('xxxhdpi', 4)):
    out = f'{res}/mipmap-{folder}'
    os.makedirs(out, exist_ok=True)
    layer = round(108 * scale)
    legacy = round(48 * scale)
    sized(src['background'], layer).save(f'{out}/ic_launcher_background.png')
    sized(src['foreground'], layer).save(f'{out}/ic_launcher_foreground.png')
    sized(src['monochrome'], layer).save(f'{out}/ic_launcher_monochrome.png')
    masked(src['icon'], legacy, 'square').save(f'{out}/ic_launcher.png')
    masked(src['icon'], legacy, 'circle').save(f'{out}/ic_launcher_round.png')

# iOS: opaque PNGs (the App Store rejects alpha); iOS rounds the corners itself.
ios = f'{repo}/apps/mobile/ios/MovoMobile/Images.xcassets/AppIcon.appiconset'
flat = Image.new('RGB', (1024, 1024), (244, 238, 240))
flat.paste(src['icon'], (0, 0), src['icon'])
contents = json.load(open(f'{ios}/Contents.json'))
for entry in contents['images']:
    pt = float(entry['size'].split('x')[0])
    px = round(pt * int(entry['scale'][0]))
    name = f'icon-{px}.png'
    flat.resize((px, px), Image.LANCZOS).save(f'{ios}/{name}')
    entry['filename'] = name
json.dump(contents, open(f'{ios}/Contents.json', 'w'), indent=2)
open(f'{ios}/Contents.json', 'a').write('\n')

# Play Store listing icon (512, opaque).
flat.resize((512, 512), Image.LANCZOS).save(f'{repo}/docs/design/app-icon/play-store-512.png')
print('icons written')
PY
