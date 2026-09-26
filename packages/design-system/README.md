# @movo/design-system

Tokens, Tailwind preset, fonts, icon data, and (soon) React Native primitives for MOVO.

- `src/tokens/` — the single source of truth (colors, type, spacing, radius, elevation, motion).
- `src/icons/` — `icon-map.ts` (MOVO name → Iconsax name) and the generated `icon-data.ts`.
- `tailwind.preset.js` — maps tokens to Tailwind names for NativeWind.
- `assets/fonts/` — Poppins 400 / 500 / 600 / 700 (OFL). Poppins covers Latin and Devanagari.
- `preview/` — an HTML page that renders the tokens, icons, components, and key screens.

Full guide: [`docs/06-design-system.md`](../../docs/06-design-system.md).

```bash
pnpm --filter @movo/design-system fonts          # copy Poppins from @expo-google-fonts/poppins
pnpm --filter @movo/design-system icons          # regenerate icon data from the iconsax package
pnpm --filter @movo/design-system check:preset   # preset loads and has the expected keys
pnpm --filter @movo/design-system preview        # writes preview/dist/index.html
```
