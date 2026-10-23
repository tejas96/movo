# MOVO app icon

Chosen on 2026-10-23: **"Orb on glow"**, the glowing coral orb with the roof M (two roofs and a door) on the
Soft Glow pastel glow. `options.png` shows the three options that were compared.

| File | Use |
| --- | --- |
| `icon.svg` | full icon: iOS, Play Store, legacy Android icons |
| `background.svg` | Android adaptive icon, back layer (the glow) |
| `foreground.svg` | Android adaptive icon, front layer (orb and M), inside the 66 dp safe zone |
| `monochrome.svg` | Android 13+ themed icon (the M only; Android tints it) |

Change a source, then run `./build.sh` from this folder. It renders the SVGs with headless Chrome and writes
every Android mipmap size and the iOS AppIcon set. Needs Google Chrome and Python with Pillow.
