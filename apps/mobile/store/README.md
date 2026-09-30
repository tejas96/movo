# Google Play store material

Everything the Play Console asks for outside the AAB. Package `com.movo.app`, app name MOVO, default language English (India), free, no ads.

| File | What it is | Where it goes in Play Console |
| --- | --- | --- |
| `listing.md` | App name, short and full description for en-IN, hi-IN and mr-IN with character counts; category, tags, contact email, policy URLs; release notes for the first internal test | Grow users → Store presence → **Main store listing** (name, short, full description; Hindi and Marathi under *Manage translations → Add your own translations*). Category, tags, email, website → **Store settings**. Release notes → Test and release → Internal testing → Create release |
| `icon-512.png` | 512×512 app icon, 32-bit PNG | Main store listing → **Graphics → App icon** |
| `feature-graphic.png` | 1024×500 PNG, no alpha | Main store listing → **Graphics → Feature graphic** |
| `screenshots/en/01…08-*.png` | 8 framed phone screenshots, 1080×1920 (9:16), English captions and English app | Main store listing → **Graphics → Phone screenshots** (en-IN). Upload in file order; Play allows 2–8 |
| `screenshots/hi/01…08-*.png` | Same set with Hindi captions and the app in Hindi | Manage translations → hi-IN → Phone screenshots. For mr-IN, use the English set until a Marathi set exists (Play falls back to the default language's graphics) |
| `play-forms.md` | Answers for Privacy policy, Ads, App access (reviewer login template), Content rating (IARC), Target audience (18+), other declarations, and the Data safety form checked against the code | Policy and programs → **App content** (each form) |
| `tools/` | Python scripts that made the files: `feature.py` (feature graphic), `frame.py` (screenshot frames), `listing.py` (writes `listing.md` and checks lengths) | Not uploaded. Re-run with `python3 tools/<script>.py` after editing texts. `frame.py` reads raw emulator captures from the `RAW` path at its top; change it to where your new captures are |

## Notes

- Screenshots show the local demo society "Sunrise Residency" with demo data (Pune, 24 flats). All photos are the bundled Unsplash photos from `packages/design-system/assets/photos/` (credits in `CREDITS.md`). The feature graphic uses `society.jpg`, cropped, with the builder's name on the roof retouched out.
- Raw captures are 1080×2400 (20:9). Play rejects a long side over 2× the short side, so the framed 9:16 versions are the ones to upload.
- Text inside the Hindi screenshots that members typed (notice titles, listing names) stays in English, as it would in a real society.
- Hindi captions need Pillow with libraqm (Devanagari shaping). On macOS: `brew install fribidi`, then `python3 -c "from PIL import features; print(features.check('raqm'))"` prints True.
- Before the first production release, re-check `listing.md` and `play-forms.md` against what the build actually contains (push notifications need Firebase set up; the AR guide adds the camera permission).
