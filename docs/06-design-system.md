# Design system

Name: **MOVO DS**. Version 0.2. Light theme. Source of truth: `packages/design-system/src/tokens/` and `src/icons/`.
Preview: run `pnpm design:preview` and open `packages/design-system/preview/dist/index.html`.

## 1. Feel

A copy of the reference real-estate app's language, applied to society life:

- **White canvas.** Screens are white. Cards are soft gray. Anything inside a gray card is white again. A tile inside a gray card is one shade deeper gray.
- **No borders, no shadows.** Depth comes only from those alternating fills. The one exception is the floating tab bar (and sheets), which has a soft shadow and a blurred white background.
- **Black is the only action color.** Filled buttons, the filter square, the active tab pill, and the call and chat circles are near-black. Everything else is gray or white.
- **Big radii.** 20 for chips, tiles, icon squares and inputs. 24 for photos inside cards. 28 for cards and sheets. Full pills for buttons, info pills and the tab bar.
- **Poppins.** Titles SemiBold, gray labels Regular, chips and buttons Medium. Poppins covers Devanagari, so Hindi and Marathi look identical in weight and rhythm.
- **Iconsax icons.** Outline (`linear`) by default. Filled (`bold`) for the active tab, header icons, tiles and pills.
- **Status color stays small.** Paid, Pending, Overdue live in small soft pills. Nothing else is coloured.

## 2. Tokens

### Color

| Token | Value | Use |
| --- | --- | --- |
| bg.canvas | `#FFFFFF` | screen background |
| bg.card | `#F5F5F5` | cards, chips, search bar, tiles, icon squares |
| bg.cardDeep | `#EFEFEF` | tiles inside a gray card |
| bg.nested | `#FFFFFF` | pills, rows, icon boxes inside a gray card |
| bg.alt | `#F6F6F6` | sheet background |
| bg.ink | `#151515` | filled buttons, filter square, active tab pill, action circles |
| bg.inkPressed | `#000000` | pressed state |
| bg.overlay | `rgba(255,255,255,0.92)` | pills over photos |
| bg.tabBar | `rgba(255,255,255,0.88)` | floating tab bar, with 20px blur |
| text.primary | `#151515` | titles, values |
| text.secondary | `#8A8A8A` | labels, meta, "See all", placeholders |
| text.tertiary | `#AFAFAF` | hints |
| text.disabled | `#C8C8C8` | disabled |
| text.onInk | `#FFFFFF` | text on black |
| icon.inactive | `#5C5C5C` | inactive tab icons |
| border.divider | `#EAEAEA` | 1px separator inside a card |
| border.focus | `#151515` | focused input outline |
| status.success | `#157543` on `#E8F6EE` | Paid, Approved, Done |
| status.warning | `#9B6400` on `#FFF4E0` | Pending, Due |
| status.danger | `#A83030` on `#FDECEC` | Overdue, Missed, Emergency |
| status.info | `#2B4F9E` on `#EAF0FD` | Scheduled |
| status.neutral | `#5C5C5C` on `#EFEFEF` | Draft, Trial |

Tailwind names: `bg-canvas`, `bg-card`, `bg-card-deep`, `bg-card-nested`, `bg-ink`, `text-ink`, `text-ink-secondary`, `text-ink-tertiary`, `text-on-ink`, `text-icon-inactive`, `border-divider`, `bg-success-soft text-success`, and so on. The raw `gray-*` scale exists as an escape hatch. No hex values in screens.

### Typography

Family: **Poppins** (400, 500, 600, 700). One family for English, Hindi and Marathi. Screens never set `fontFamily`; the `Text` primitive does.

| Variant | Size / line | Weight | Use |
| --- | --- | --- | --- |
| display | 28 / 36 | 600 | prices, big numbers |
| h1 | 24 / 32 | 600 | detail title |
| h2 | 20 / 28 | 600 | section title ("Real estate suggestion") |
| h3 | 18 / 26 | 600 | card title, centred screen title |
| title | 16 / 24 | 600 | header value ("New york city"), person name |
| body | 15 / 22 | 400 | paragraphs, placeholders |
| bodyMedium | 15 / 22 | 500 | chips, buttons, pills, tab label |
| caption | 14 / 20 | 400 | descriptions, meta rows, tile labels (500) |
| label | 13 / 18 | 400 | small gray labels ("Location", "Property Agent") |
| micro | 12 / 16 | 500 | badges, counters |

Line heights are about 1.4 because Poppins has tall Devanagari ascenders. Tailwind: `text-h2`, `text-body-medium`, `font-semibold`.

### Radius, spacing, sizes

| Token | Value |
| --- | --- |
| radius xs / sm / md / lg / xl / full | 10 / 14 / 20 / 24 / 28 / pill |
| gutter | 20 |
| card padding, photo inset | 20, 8 |
| icon square (header actions) | 52, radius 20. Small variant 44, radius 14 |
| circle button (call, chat, heart) | 44 |
| search bar | 56 pill. Filter square 56, radius 20, black |
| category chip | 52 high, radius 20, white 40 icon box with radius 14 inside |
| buttons sm / md / lg | 44 / 52 / 56, full pill |
| input | 56, radius 20, gray fill, 1.5px black outline on focus |
| info pill / small pill | 40 / 34, full pill |
| status pill | 26 |
| tile | 3 columns, radius 20, padding 16, min height 96 |
| tab bar | 60 high, inset 24, bottom 20, active pill 48 |
| avatars | 32 / 44 / 56 / 64 |
| icons | 24 default, 22 in chips and tabs, 20 in circles, 18 in pills, 16 next to text |
| touch target | 48 minimum |

### Elevation and motion

- Cards: none. Tab bar: `0 8px 24px rgba(17,17,17,0.10)` plus 20px backdrop blur. Sheet: `0 -8px 24px rgba(17,17,17,0.06)`.
- Durations 150 / 250 / 400 ms. Pressed state: opacity 0.85 or `inkPressed`.

## 3. Fonts in React Native

Files: `packages/design-system/assets/fonts/Poppins-{Regular,Medium,SemiBold,Bold}.ttf`, copied from `@expo-google-fonts/poppins` by `pnpm --filter @movo/design-system fonts`.

- **iOS**: `react-native.config.js` lists the fonts folder; `npx react-native-asset` adds them to `Info.plist`. PostScript names are `Poppins-Regular`, `Poppins-Medium`, `Poppins-SemiBold`, `Poppins-Bold`.
- **Android**: copy to `android/app/src/main/res/font/` as `poppins_regular.ttf` and so on, add `poppins.xml` mapping weights 400 to 700, register with `ReactFontManager` in `MainApplication.kt`. Then `fontFamily: 'Poppins'` plus `fontWeight` works on both platforms (the heliogrid setup).

## 4. Icons

- Source: the `iconsax` npm package (free set, 1,211 icons, six styles). MOVO uses `linear` and `bold`.
- `src/icons/icon-map.ts` maps MOVO names to Iconsax names (`home → home-2`, `notices → volume-high`, `duties → repeat`, ...). About 100 icons.
- `pnpm --filter @movo/design-system icons` writes `src/icons/generated/icon-data.ts`: SVG nodes with colors normalised to `currentColor`.
- React Native: an `Icon` component renders the nodes with `react-native-svg` (`<Icon name="bell" style="bold" size={24} />`). Web and the preview use `iconSvgMarkup()`.
- Adding an icon: add one line to the map, run the script. Never import an icon from another package.

## 5. Primitives (built with the mobile scaffold)

| Component | Notes |
| --- | --- |
| Screen | white canvas, safe area, optional scroll and keyboard avoiding |
| TopBar | icon square + label/value block + trailing icon square (Home header). Or back square + centred h3 title + optional action square |
| Text | variant, tone (primary, secondary, tertiary, inverse, status), Poppins weights |
| Button | ink (default), gray, white, ghost, danger; sm 44, md 52, lg 56; icon; loading; disabled; full width by default |
| IconSquare | 52 or 44; gray, white, ink; optional dot |
| CircleButton | 44; ink or white |
| SearchBar + FilterButton | 56 pill and 56 black square |
| Chip | 52 with white icon box; `plain` without icon; selected = ink |
| Pill | 40 or 34; white on gray, gray on white, overlay on photos; icon 18 |
| StatusPill | 26; success, warning, danger, info, neutral, ink |
| Card | gray 28; `tight` (padding 8) for row lists; `white` when the canvas is gray |
| Row | white 20 inside a gray card; 68 min height; leading icon square 44 or avatar; title, subtitle; trailing value, pill or chevron |
| MediaCard | gray 28, photo 24 with 8 inset, overlay pills and heart, info block with title, meta, divider, pills, price |
| Tile | 3-column grid; gray or deep gray; bold icon, label, hint, optional count badge |
| PersonCard | gray 24; avatar 44, name with verified badge, role; ink circles for chat and call |
| DateBlock | 56 x 60 white block with day and month |
| DateTimeSheet | bottom sheet with a day strip, an hour strip and quarter-hour minutes. `mode="date"` hides the time; `pastDays` allows past dates. Pure JS, phone time zone |
| Input, Select | 56, radius 20; label above in gray 13; helper and error below |
| Segmented | gray pill track 48, ink active pill |
| Toggle | ink when on |
| FloatingTabBar | 60 pill, blur, shadow; active item is an ink pill with bold icon and label |
| BottomBar | white, value left (label + 24 bold), ink button right; used on detail screens instead of the tab bar |
| Sheet | radius 28 top, grabber, white inputs on the `alt` background |
| Toast | ink, radius 20 |
| EmptyState | icon square, title, one line, optional white button |
| Avatar | circle; image or initials on white or gray |
| Skeleton | gray blocks matching the layout |

## 6. Screen patterns

- **Home**: top bar (society block + bell), search + filter, chip row, then sections "Needs you today", "Upcoming", "Notices". Each section is an h2 with "See all".
- **Hub**: title + search square, 3-column tiles, then a person card list.
- **List**: centred header, search + filter, chip row, cards.
- **Detail**: centred header with back and more squares, hero card, row lists, bottom bar with value and one ink button.
- **Form**: sheet or screen with gray inputs, labels above, one ink button at the bottom.

## 7. Rules

1. Classes come from the preset. No hex values, no magic numbers in screens.
2. New visual needs become a primitive or a token first.
3. One ink button per screen.
4. Never show an action the user cannot perform.
5. Every screen is reviewed in English, Hindi and Marathi before merge.
6. Changing a token or an icon means running `pnpm design:preview` and checking the preview.
