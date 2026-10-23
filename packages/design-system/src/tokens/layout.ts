/** 4dp grid. Mirrors Tailwind's default spacing so class names stay familiar. */
export const space = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Big radii are the signature of this style. */
export const radius = {
  /** Small badges. */
  xs: 10,
  /** Icon boxes inside chips. */
  sm: 14,
  /** Chips, tiles, icon squares, inputs. */
  md: 20,
  /** Photos inside cards. */
  lg: 24,
  /** Glass lists, sheets. */
  xl: 28,
  /** Glass cards. */
  '2xl': 30,
  /** Big glass cards (greeting). */
  '3xl': 32,
  /** Outer corner of a rimmed art card (the art inside is 5 less). */
  rim: 34,
  /** Buttons, pills, tab bar. */
  full: 9999,
} as const;

export const layout = {
  /** Horizontal screen padding. */
  gutter: 18,
  /** Width of the white rim around art cards. */
  rim: 5,
  /** Padding inside a card's text area. */
  cardPadding: 20,
  /** Gap between a card edge and the photo inside it. */
  cardInset: 8,
  sectionGap: 24,
  /** Floating tab bar. */
  /** Glass tab bar: 7 padding around 50 high items, centred, 24 above the bottom. */
  tabBar: { height: 64, inset: 24, bottom: 24, activeHeight: 50, padding: 7, item: 50 },
  /** Minimum size of anything tappable. */
  touchTarget: 44,
  /** Buttons and inputs. md = pill buttons in cards, lg = page buttons, xl = hero buttons. */
  control: { sm: 40, md: 50, lg: 54, xl: 60 },
  /** Round white icon buttons (header actions, filter). */
  iconButton: { md: 46, sm: 44 },
  /** Round icon buttons (call, arrow). */
  circleButton: 44,
  /** Chip height and the icon box inside it. */
  chip: { height: 40, iconBox: 30 },
  /** Info pills (bed 4, rating 4.5) and photo overlay pills. */
  pill: { md: 40, sm: 34 },
  icon: { sm: 18, md: 20, lg: 24, xl: 28 },
  avatar: { sm: 32, md: 44, lg: 56, xl: 64 },
  /** Facility-style tiles in a 3-column grid. */
  tile: { minHeight: 88, padding: 16 },
} as const;
