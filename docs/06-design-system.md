# Design system

Name: **MOVO DS**. Version 1.0, **Soft Glow**. Light theme. Source of truth: `packages/design-system/src/tokens/` and `src/icons/`.
Preview: run `pnpm design:preview` and open `packages/design-system/preview/dist/index.html`.
Visual reference: `docs/design/soft-glow/` — the mockup source (`source/*.dc.html`), a local viewer and
`capture.sh`, which renders the reference PNGs in `ref/` at 390 × 844 pt, 3x. Screens must match them.

## 1. Feel

Calm, light and premium, inspired by the "Sense" meditation app. Chosen by the user on 2026-10-23.

- **Mist and glow.** Pages are mist `#EEEDEC`. A soft pink and lavender glow drifts slowly at the bottom (`Backdrop`, scenes in `tokens/glow.ts`). `Screen` draws it by default.
- **Frosted glass.** Cards are white at 50% with a bright white rim, a white top highlight and a wide plum-tinted shadow (`Glass`, `Card`). Lists are rows inside one glass card, with no fill per row.
- **Moving colour art.** Big cards are dreamy blurred gradients that drift slowly inside a thick white rim (`ArtCard`, `ArtFill`, presets in `tokens/glow.ts`). A white fade at the bottom keeps text readable.
- **The orb.** A glossy coral sphere that breathes is the brand mark and the avatar style (`Orb`). Do not add it where a drawing already fills the card.
- **Small animated drawings.** The building, dues ring, coins, diya, water drop, megaphone, map pin and avatars move gently. Everything rises into place on open (`Rise`) and all motion stops when the phone asks for less motion.
- **Ink for actions, orange for accents.** Main buttons are ink pills with a white circle and an orange arrow (`Button arrow`). Orange marks only small things: unread dots, the selected tab icon, arrows, play buttons. Red is only for urgent things.
- **Big radii.** 30 for glass cards, 34 outside / 29 inside for rimmed art cards, 28 for glass lists, 22 for rows, full pills for buttons, chips, search and the tab bar.
- **Poppins.** Headlines are Regular with one SemiBold word (`Strong`). Screen titles SemiBold, card titles Medium, labels Regular, section labels in small capitals. Poppins covers Devanagari, so Hindi and Marathi keep the same weight and rhythm.
- **App icon.** The glowing orb with the roof M on the pastel glow. Sources and the build script are in `docs/design/app-icon/`.
- **Iconsax icons.** Outline (`linear`) by default; filled (`bold`) and orange for the selected tab.

## 2. Tokens

Values below are copied from `packages/design-system/src/tokens/` (checked 2026-10-23). If they ever differ, the TypeScript tokens win.

### Color

| Token | Value | Use |
| --- | --- | --- |
| bg.canvas | `#EEEDEC` (mist) | page background, under the glow |
| bg.card | white at 0.5 | glass cards, glass chips, rows on the page |
| bg.cardDeep | white at 0.75 | rim of art cards, pills on art |
| bg.nested | `#FFFFFF` | inputs, selected chip, white buttons, icon buttons |
| bg.alt | `#EEEDEC` | sheet background |
| bg.ink | `#2B2A2E` | main buttons, + buttons, picked flat |
| bg.inkPressed | `#1C1B1E` | pressed ink |
| bg.overlay | white at 0.85 | pills on art and photos |
| bg.scrim | ink at 0.4 | behind sheets |
| bg.tabBar | `#FDFCFD` | tab bar and bottom bar (solid: no live blur on Android) |
| text.primary | `#2B2A2E` | titles, values |
| text.soft | `#4D4C52` | text on art cards |
| text.secondary | `#6A6970` | labels, meta, placeholders |
| text.tertiary | `#9C9BA1` | hints |
| text.disabled | `#C3C2C7` | disabled |
| text.onInk | `#FFFFFF` | text on ink |
| border.glass | white at 0.95 | 1.5 rim of glass cards |
| border.divider | ink at 0.08 | line inside a card |
| border.focus | `#F06A2E` | focus ring (drawn as a 4 px orange glow at 0.18) |
| accent | `#F06A2E` on `#FDE6DA` | unread dots, arrows, selected tab icon, links ("See all"), switch on |
| status.success | `#3F7A45` on `#E6F1E3` | Paid, Done |
| status.warning | `#8A5410` on `#FBEBD3` | Due, In progress |
| status.danger | `#B52E2E` on `#FBE2E2` | Overdue, urgent, Sign out; red fill `#D63B3B` only for call 112 and Remove |
| status.info | `#3F51A8` on `#E6E9FA` | Scheduled |
| status.neutral | `#4D4C52` on `#F4F3F2` | Draft, Cancelled |

Pastel glow and art colours (pink `#F4B3C2`, lavender `#CDB2F0`, peach `#F8CDB0`, the art presets and the orb stops) live in `tokens/glow.ts`.

Tailwind names: `bg-canvas`, `bg-card`, `bg-card-deep`, `bg-card-nested`, `bg-ink`, `bg-accent`, `text-ink`, `text-ink-secondary`, `border-glass`, `bg-success-soft text-success`, and so on. No hex values in screens.

### Typography

Poppins only. Line heights are about 1.3 to 1.45 because Poppins has tall Devanagari ascenders.

| Variant | Size / line | Weight | Use |
| --- | --- | --- | --- |
| display | 46 / 52 | 500, tracking -1.2 | money on hero cards |
| greet | 27 / 34 | 400, tracking -0.4 | headlines with one bold word (`Strong`) |
| h1 | 26 / 34 | 600, tracking -0.4 | screen title |
| h2 | 20 / 27 | 500 | title on an art card |
| h3 | 16 / 23 | 500 | card title |
| title | 15 / 22 | 500 | row title, person name |
| body | 15 / 22 | 400 | paragraphs, placeholders |
| bodyMedium | 14 / 20 | 500 | chips, buttons, pills, tab label |
| caption | 13 / 19 | 400 | subtitles, meta; field labels (500) |
| label | 12 / 17 | 400 | small labels and tags |
| section | 12 / 17 | 400, tracking 0.6, capitals | section labels (THIS WEEK, GENERAL) |
| micro | 11 / 15 | 500 | badges, counters |

### Radius, spacing, sizes

| Token | Value |
| --- | --- |
| radius xs / sm / md / lg / xl / 2xl / 3xl / rim / full | 10 / 14 / 20 / 24 / 28 / 30 / 32 / 34 / pill |
| gutter | 18 (Event detail: 14) |
| page top | safe area + 8 (58 pt on the 390 × 844 mockup); Event detail 4 higher |
| gap between cards | 14 |
| glass card | radius 30, padding 18, rim 1.5 |
| glass list | radius 28, padding 8; rows 54 to 66 high, radius 22, no fill |
| art card | rim 5 white at 0.75, outer radius 34 (40 on heroes), art radius 5 less |
| controls sm / md / lg / xl | 40 / 50 / 54 / 60, full pill |
| input, select | 54 white pill, label above (caption 500), focus = 4 px orange glow |
| icon button | 46 white circle (44 small) |
| circle button (call) | 44 |
| chip | 40 glass pill; selected = white |
| switch | 50 × 30 track, 24 knob |
| tab bar | items 50, padding 7, 24 above the bottom |
| avatars | 32 / 44 / 56 / 64; profile orb 92 |
| icons | 24 default, 21 in list rows, 20 in buttons, 17 in call buttons |
| touch target | 44 minimum |

### Elevation and motion

Shadows are soft and plum-tinted, never gray-black. Same string on web and in React Native `boxShadow`.

| Token | Value | Use |
| --- | --- | --- |
| glass | `inset 0 1px 0 rgba(255,255,255,.8), 0 10px 30px rgba(70,40,70,.06)` | glass cards, tab bar |
| rim | `0 10px 30px rgba(70,40,70,.08)` | art cards |
| control | `0 4px 14px rgba(70,40,70,.06)` | inputs, icon buttons, search |
| lifted | `0 4px 12px rgba(70,40,70,.08)` | selected segment, active tab |
| sheet | `0 -8px 30px rgba(70,40,70,.08)` | sheets, bottom bar |

- Blur: glass 22 (where supported), art 26, glow 80.
- Durations 150 / 250 / 400 ms; cards rise over 800 ms with `cubic-bezier(.2,.8,.2,1)`, 60 ms apart. Presses spring with `cubic-bezier(.3,1.5,.5,1)`.
- Pressed state: scale 0.97 (`Press`) or opacity 0.85. Disabled: opacity 0.4.
- All motion stops when the phone asks for reduced motion.

## 3. Fonts in React Native

Files: `packages/design-system/assets/fonts/Poppins-{Regular,Medium,SemiBold,Bold}.ttf`, copied from `@expo-google-fonts/poppins` by `pnpm --filter @movo/design-system fonts`.

- **iOS**: `react-native.config.js` lists the fonts folder; `npx react-native-asset` adds them to `Info.plist`. PostScript names are `Poppins-Regular`, `Poppins-Medium`, `Poppins-SemiBold`, `Poppins-Bold`.
- **Android**: copy to `android/app/src/main/res/font/` as `poppins_regular.ttf` and so on, add `poppins.xml` mapping weights 400 to 700, register with `ReactFontManager` in `MainApplication.kt`. Then `fontFamily: 'Poppins'` plus `fontWeight` works on both platforms (the heliogrid setup).

## 4. Icons

- Source: the `iconsax` npm package (free set, 1,211 icons, six styles). MOVO uses `linear` and `bold`.
- `src/icons/icon-map.ts` maps MOVO names to Iconsax names (`home → home-2`, `notices → volume-high`, `duties → repeat`, ...). About 130 names.
- `pnpm --filter @movo/design-system icons` writes `src/icons/generated/icon-data.ts` with only the icons the app uses: a name ships when it appears as a string literal in `apps/mobile/src` or `packages/design-system/src` (or in the script's `KEEP` list). Colors are normalised to `currentColor`; attributes every node of a style shares (stroke width, caps, fill) are stored once in `src/icons/expand.ts`, so the file holds geometry only.
- `bold` ships only for the names in `boldIcons` (icon-map.ts). The types enforce it: `IconName` is the shipped set and `BoldIconName` the bold set; `variant="bold"` and the bold-by-default slots (IconSquare, CircleButton, Tile, Pill, Row, EmptyState, tabs, photo pills) take a `BoldIconName`.
- React Native: an `Icon` component renders the nodes with `react-native-svg` (`<Icon name="bell" variant="bold" size={24} />`). Web and the preview use `iconSvgMarkup()`.
- Adding an icon: add one line to the map, use it, run the script. When TypeScript says a name is not a `BoldIconName`, add it to `boldIcons` and run the script again. Never import an icon from another package.

## 5. Primitives

| Component | Notes |
| --- | --- |
| Screen | mist page with the `Backdrop` glow (`glow` picks the scene), safe area, scroll, keyboard avoiding |
| Glass | frosted card; children inside it know they are in glass (`useInGlass`), so rows drop their own fill |
| Card | glass card, radius 30, padding 18. `tight` = a glass list (radius 28, padding 8) |
| ArtCard, ArtFill | moving colour art in a white rim; presets in `tokens/glow.ts` |
| Orb, Ripple, DotTexture | the coral orb, its ripple, the fading dot grid |
| Drawings | Building, DuesRing, Coin, Diya + Sparks, WaterDrop, MovingIcon, MapPin, GlowAvatar, AvatarStack, WavingHand |
| Rise | cards rising into place, 60 ms apart |
| Text | variants above; tones primary, secondary, soft, accent, inverse, status; `Strong` for the bold word |
| TitleBar, ModuleHeader | 46 round back button, h1 title on the left, action on the right |
| Button | ink (default), white, gray, ghost, danger, dangerText; sm 40, md 50, lg 54, xl 60; `arrow` adds the white circle with the orange arrow; `sheen` adds the moving light band |
| IconSquare | round 46 or 44 icon button; white, gray or ink; optional orange dot |
| CircleButton | 44; ink, white or `accent` |
| SearchBar | 50 white pill |
| Chip | 40 glass pill; selected = white |
| Pill, StatusPill | info pills and soft status pills |
| Row | glass pill on the page, plain inside a glass card; leading icon or avatar, title, subtitle, trailing |
| PersonCard | glowing avatar, name with badge, role, actions |
| Tile, DateBlock | glass tile; white date block |
| Input, SelectField, TextArea, PasswordInput | 54 white pill, label above, orange focus glow, `prefix` (+91); password eye in a gray circle |
| Segmented | glass track, white selected pill |
| Toggle | 50 × 30, orange when on, springy knob |
| FloatingTabBar | solid pill; active item is a white pill with an orange icon and a label |
| BottomBar | solid near-white bar with round top corners; value left, ink button right |
| Sheet, OptionSheet | radius 32 top on mist |
| EmptyState | glass card, icon on a colour-art disc, title, one line, optional button |
| Avatar | photo, or initials on a soft colour glow |
| Skeleton | soft blocks matching the layout |
| DetailHero (app, `core/ui`) | top of detail screens: art, back and options buttons, a moving icon or drawing, pills, big title, meta |
| PagedList `glass` (app, `core/ui`) | puts all rows of a paged list in one glass card |

## 6. Screen patterns

- **Home**: search pill + bell + profile, chips, greeting card with facts, next-up pill, art cards (home, dues ring, notices, shortcuts, members), then a glass "Needs you" list.
- **Hub (Society)**: title + search, the society on a building art card, modules as moving art tiles, committee in a glass list.
- **List**: back + title + ink "+", chips or a segmented switch, then all rows in one glass card.
- **Detail**: `DetailHero` art header, content in glass cards below, one main action (ink, with arrow) or a bottom bar.
- **Form**: back + title, all fields in one glass card, the save button in the bottom bar.
- **Front door (Welcome, Log in, Join)**: `AuthShell`: back · MOVO header, a dotted glass card with a small drawing and a split headline, the main button with arrow at the bottom.

## 7. Rules

1. Classes come from the preset. No hex values, no magic numbers in screens.
2. New visual needs become a primitive or a token first.
3. One ink button per screen. Red fills only for urgent or final actions.
4. Never show an action the user cannot perform.
5. Every screen is reviewed in English, Hindi and Marathi before merge.
6. Changing a token or an icon means running `pnpm design:preview` and checking the preview.

## Photo components

`PhotoHeader` and `PhotoCard` remain for real photos (market listings, orders). They use the white rim and glass. `ModuleHeader` no longer draws a photo. Stock photos (`photos.*`) are not used in Soft Glow screens.

## Keyboard (Android edge to edge)

The window does not resize for the keyboard, so the design system handles it once: `Screen` and `Sheet` use `KeyboardAvoidingView` with `padding` on both platforms, `BottomBar` rides on top of the keyboard (`useKeyboardHeight`), and a scrolling `Screen` scrolls the focused `Input` into view above the keyboard and the bar. Screens need no keyboard code of their own.
