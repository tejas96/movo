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
  /** Cards, sheets, hero corners. */
  xl: 28,
  /** Buttons, pills, tab bar. */
  full: 9999,
} as const;

export const layout = {
  /** Horizontal screen padding. */
  gutter: 20,
  /** Padding inside a card's text area. */
  cardPadding: 20,
  /** Gap between a card edge and the photo inside it. */
  cardInset: 8,
  sectionGap: 24,
  /** Floating tab bar. */
  tabBar: { height: 60, inset: 24, bottom: 20, activeHeight: 48 },
  /** Minimum size of anything tappable. */
  touchTarget: 48,
  /** Buttons and inputs. */
  control: { sm: 44, md: 52, lg: 56 },
  /** Square icon buttons (header actions, filter). */
  iconButton: { md: 52, sm: 44 },
  /** Round icon buttons (heart, call, chat). */
  circleButton: 44,
  /** Category chip height and the white icon box inside it. */
  chip: { height: 52, iconBox: 40 },
  /** Info pills (bed 4, rating 4.5) and photo overlay pills. */
  pill: { md: 40, sm: 34 },
  icon: { sm: 18, md: 20, lg: 24, xl: 28 },
  avatar: { sm: 32, md: 44, lg: 56, xl: 64 },
  /** Facility-style tiles in a 3-column grid. */
  tile: { minHeight: 88, padding: 16 },
} as const;
