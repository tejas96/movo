import { color, light } from './color';
import { blur, elevation, motion, opacity } from './effects';
import { layout, radius, space } from './layout';
import { palette } from './palette';
import { typography } from './typography';

export type { ColorPair, SemanticColors } from './color';
export type { TypeVariant } from './typography';
export {
  blur,
  color,
  elevation,
  layout,
  light,
  motion,
  opacity,
  palette,
  radius,
  space,
  typography,
};

/** Single source of truth. The Tailwind preset and the design preview both read this object. */
export const tokens = {
  palette,
  color,
  typography,
  space,
  radius,
  layout,
  elevation,
  blur,
  motion,
  opacity,
} as const;

export type Tokens = typeof tokens;
