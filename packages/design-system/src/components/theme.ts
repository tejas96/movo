import { light } from '../tokens/color';
import { elevation } from '../tokens/effects';
import { glow } from '../tokens/glow';
import { layout, radius } from '../tokens/layout';

/** Values for places that cannot use className: SVG and Skia drawings, shadows, StatusBar. */
export const theme = {
  color: light,
  radius,
  layout,
  glow,
  shadow: {
    tabBar: elevation.tabBar.native,
    sheet: elevation.sheet.native,
    glass: elevation.glass.native,
    rim: elevation.rim.native,
    control: elevation.control.native,
    lifted: elevation.lifted.native,
  },
} as const;

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'ink';
