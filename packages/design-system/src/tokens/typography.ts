/**
 * Type scale. One family, Poppins, covers Latin and Devanagari.
 * Sizes are dp/sp taken from the Soft Glow mockup at 390 wide.
 * Line heights stay about 1.3-1.45x because Poppins has tall Devanagari ascenders.
 * The Soft Glow voice: light text with one bold word ("Good evening **Priya**") for greetings,
 * semibold only for screen titles, medium for everything you tap or scan.
 */
export const typography = {
  family: {
    sans: 'Poppins',
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  scale: {
    /** Big money amounts on hero cards (₹2,400). */
    display: { size: 46, lineHeight: 52, weight: '500', letterSpacing: -1.2 },
    /** Greeting and page headlines: regular, with one bold word inside. */
    greet: { size: 27, lineHeight: 34, weight: '400', letterSpacing: -0.4 },
    /** Screen title (Notices, Money). */
    h1: { size: 26, lineHeight: 34, weight: '600', letterSpacing: -0.4 },
    /** Title on an art card (Notices, Diwali night). */
    h2: { size: 20, lineHeight: 27, weight: '500', letterSpacing: -0.3 },
    /** Card title (Maintenance, What you paid). */
    h3: { size: 16, lineHeight: 23, weight: '500', letterSpacing: 0 },
    /** Row title, person name. */
    title: { size: 15, lineHeight: 22, weight: '500', letterSpacing: 0 },
    /** Paragraph text and placeholders. */
    body: { size: 15, lineHeight: 22, weight: '400', letterSpacing: 0 },
    /** Chips, buttons, pills, tab label. */
    bodyMedium: { size: 14, lineHeight: 20, weight: '500', letterSpacing: 0 },
    /** Subtitles, meta rows. */
    caption: { size: 13, lineHeight: 19, weight: '400', letterSpacing: 0 },
    /** Small gray labels and tags. */
    label: { size: 12, lineHeight: 17, weight: '400', letterSpacing: 0 },
    /** Section labels above lists (THIS WEEK). Shown in capitals. */
    section: { size: 12, lineHeight: 17, weight: '400', letterSpacing: 0.6 },
    /** Badges and counters. */
    micro: { size: 11, lineHeight: 15, weight: '500', letterSpacing: 0 },
  },
} as const;

export type TypeVariant = keyof typeof typography.scale;
