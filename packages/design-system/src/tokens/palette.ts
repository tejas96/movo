/**
 * Raw scales. Screens never use these directly.
 * MOVO is monochrome: white canvas, soft gray cards, black actions. Color is reserved for status.
 */
export const palette = {
  white: '#FFFFFF',
  black: '#151515',
  gray: {
    50: '#F8F8F8',
    100: '#F5F5F5',
    200: '#EFEFEF',
    300: '#E4E4E4',
    400: '#C4C4C4',
    500: '#9A9A9A',
    600: '#7A7A7A',
    700: '#5C5C5C',
    800: '#3A3A3A',
    900: '#1F1F1F',
  },
  green: { 50: '#E8F6EE', 500: '#1F9D5B', 700: '#157543' },
  amber: { 50: '#FFF4E0', 500: '#D98E0B', 700: '#9B6400' },
  red: { 50: '#FDECEC', 500: '#DA4B4B', 700: '#A83030' },
  blue: { 50: '#EAF0FD', 500: '#3D6FD8', 700: '#2B4F9E' },
} as const;
