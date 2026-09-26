/**
 * Type scale. One family, Poppins, covers Latin and Devanagari.
 * Sizes are dp/sp measured from the reference at 393pt width.
 * Line heights are about 1.4x because Poppins has tall Devanagari ascenders.
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
    /** Prices and big numbers. */
    display: { size: 30, lineHeight: 38, weight: '600', letterSpacing: -0.4 },
    /** Detail screen title. */
    h1: { size: 26, lineHeight: 34, weight: '600', letterSpacing: -0.3 },
    /** Section title ("Real estate suggestion"). */
    h2: { size: 21, lineHeight: 29, weight: '600', letterSpacing: -0.2 },
    /** Card title, screen header title. */
    h3: { size: 18, lineHeight: 26, weight: '600', letterSpacing: 0 },
    /** Header value, person name. */
    title: { size: 16, lineHeight: 24, weight: '600', letterSpacing: 0 },
    /** Paragraph text and placeholders. */
    body: { size: 15, lineHeight: 22, weight: '400', letterSpacing: 0 },
    /** Chips, buttons, pills, tab label. */
    bodyMedium: { size: 15, lineHeight: 22, weight: '500', letterSpacing: 0 },
    /** Descriptions, meta rows, tile labels. */
    caption: { size: 14, lineHeight: 20, weight: '400', letterSpacing: 0 },
    /** Small gray labels ("Location", "Property Agent"). */
    label: { size: 13, lineHeight: 18, weight: '400', letterSpacing: 0 },
    /** Badges and counters. */
    micro: { size: 12, lineHeight: 16, weight: '500', letterSpacing: 0 },
  },
} as const;

export type TypeVariant = keyof typeof typography.scale;
