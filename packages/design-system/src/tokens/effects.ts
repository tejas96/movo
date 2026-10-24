/**
 * Elevation. Soft, tinted shadows (a hint of plum, never gray-black), as in the Soft Glow mockup.
 * `css` is the exact mockup value. `native` is the same shadow as a React Native `boxShadow`
 * (supported on iOS and on Android 9+ with the new architecture), so both stay identical.
 */
const shadow = (css: string) => ({ css, native: { boxShadow: css } }) as const;

export const elevation = {
  none: { css: 'none', native: { boxShadow: 'none' } },
  /** Glass cards: white inner highlight on top + a wide soft drop shadow. */
  glass: shadow('inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 10px 30px rgba(70, 40, 70, 0.06)'),
  /** Rimmed art cards. */
  rim: shadow('0 10px 30px rgba(70, 40, 70, 0.08)'),
  /** Small white controls: icon buttons, search pill, chips. */
  control: shadow('0 4px 14px rgba(70, 40, 70, 0.06)'),
  /** The selected segment, the active tab pill, the white arrow circle. */
  lifted: shadow('0 4px 12px rgba(70, 40, 70, 0.08)'),
  tabBar: shadow('inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 10px 30px rgba(70, 40, 70, 0.06)'),
  sheet: shadow('0 -8px 30px rgba(70, 40, 70, 0.08)'),
} as const;

export const blur = {
  /** Backdrop blur behind glass (where the platform supports it). */
  glass: 22,
  tabBar: 22,
  /** Blur of the moving art inside art cards. */
  art: 26,
  /** Blur of the background glow blobs. */
  glow: 80,
} as const;

export const motion = {
  duration: { fast: 150, base: 250, slow: 400, rise: 800 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0, 1)',
    accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
    /** Cards rising into place. */
    rise: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    /** Press bounce. */
    spring: 'cubic-bezier(0.3, 1.5, 0.5, 1)',
  },
  /** Gap between cards that rise one after another. */
  stagger: 60,
} as const;

export const opacity = {
  disabled: 0.4,
  pressed: 0.85,
} as const;
