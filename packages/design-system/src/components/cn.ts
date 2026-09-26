import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { typography } from '../tokens/typography';

/** "bodyMedium" → "body-medium", the class names the Tailwind preset makes. */
const SIZE_NAMES = Object.keys(typography.scale).map((n) =>
  n.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
);

/**
 * tailwind-merge only knows Tailwind's own sizes, so it took text-h1 or text-display for a
 * colour and dropped it next to text-ink. Registering the MOVO scale keeps size and colour.
 */
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: SIZE_NAMES }] } },
});

/** Joins class names and resolves Tailwind conflicts (the last bg-* wins). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
