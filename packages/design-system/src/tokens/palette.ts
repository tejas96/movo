/**
 * Raw scales. Screens never use these directly.
 * Soft Glow: a misty light page, frosted white glass, ink for text and main buttons,
 * orange only for small accents, red only for urgent things. Pastel glow colours live in glow.ts.
 * Reference: docs/design/soft-glow (mockup source and reference PNGs).
 */
export const palette = {
  white: '#FFFFFF',
  /** Page background. */
  mist: '#EEEDEC',
  /** Text, icons and the main button. `black` is the old name for the same colour. */
  ink: '#2B2A2E',
  black: '#2B2A2E',
  gray: {
    50: '#F7F6F5',
    100: '#F4F3F2',
    200: '#EEEDEC',
    300: '#E3E1E0',
    400: '#C3C2C7',
    500: '#9C9BA1',
    600: '#6A6970',
    700: '#4D4C52',
    800: '#3A393E',
    900: '#2B2A2E',
  },
  orange: { 50: '#FDE6DA', 500: '#F06A2E', 700: '#B5501F' },
  green: { 50: '#E6F1E3', 500: '#4E9A55', 700: '#3F7A45' },
  amber: { 50: '#FBEBD3', 500: '#E0962F', 700: '#8A5410' },
  red: { 50: '#FBE2E2', 500: '#D63B3B', 700: '#B52E2E' },
  blue: { 50: '#E6E9FA', 500: '#6C7FD8', 700: '#3F51A8' },
} as const;
