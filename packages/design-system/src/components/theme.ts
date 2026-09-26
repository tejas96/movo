import { light } from '../tokens/color';
import { elevation } from '../tokens/effects';
import { layout, radius } from '../tokens/layout';

/** Hex values for places that cannot use className: SVG icons, native shadows, StatusBar. */
export const theme = {
  color: light,
  radius,
  layout,
  shadow: { tabBar: elevation.tabBar.native, sheet: elevation.sheet.native },
} as const;

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'ink';
