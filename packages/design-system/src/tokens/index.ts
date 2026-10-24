import { color, light } from './color';
import { blur, elevation, motion, opacity } from './effects';
import { art, dots, glow, glowScene, orb, tint, tintCycle } from './glow';
import { layout, radius, space } from './layout';
import { palette } from './palette';
import { typography } from './typography';

export type { ColorPair, SemanticColors } from './color';
export type { ArtName, ArtPreset, ArtSpot, GlowBlob, GlowSceneName, TintName } from './glow';
export type { TypeVariant } from './typography';
export {
  art,
  blur,
  color,
  dots,
  elevation,
  glow,
  glowScene,
  layout,
  light,
  motion,
  opacity,
  orb,
  palette,
  radius,
  space,
  tint,
  tintCycle,
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
  glow,
} as const;

export type Tokens = typeof tokens;
