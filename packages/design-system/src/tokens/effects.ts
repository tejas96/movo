/**
 * Elevation. Cards are flat: gray on white or white on gray. No borders, no shadows.
 * Only the floating tab bar and sheets cast a shadow.
 */
export const elevation = {
  none: { css: 'none', native: { shadowOpacity: 0, elevation: 0 } },
  tabBar: {
    css: '0 8px 24px rgba(17, 17, 17, 0.10)',
    native: {
      shadowColor: '#111111',
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
  },
  sheet: {
    css: '0 -8px 24px rgba(17, 17, 17, 0.06)',
    native: {
      shadowColor: '#111111',
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -8 },
      elevation: 8,
    },
  },
} as const;

export const blur = {
  /** Backdrop blur behind the floating tab bar. */
  tabBar: 20,
} as const;

export const motion = {
  duration: { fast: 150, base: 250, slow: 400 },
  easing: {
    standard: 'cubic-bezier(0.2, 0, 0, 1)',
    decelerate: 'cubic-bezier(0, 0, 0, 1)',
    accelerate: 'cubic-bezier(0.3, 0, 1, 1)',
  },
} as const;

export const opacity = {
  disabled: 0.4,
  pressed: 0.85,
} as const;
