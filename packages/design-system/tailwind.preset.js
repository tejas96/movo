/**
 * MOVO Tailwind preset for NativeWind v4 (Tailwind CSS 3.4).
 * The TypeScript tokens are the source of truth; this file only maps them to Tailwind names.
 *
 * Usage in apps/mobile/tailwind.config.js:
 *   presets: [require('@movo/design-system/tailwind-preset')]
 */
const { createJiti } = require('jiti');

const jiti = createJiti(__filename);
/** @type {import('./src/tokens').Tokens} */
const tokens = jiti('./src/tokens/index.ts').tokens;

const c = tokens.color.light;
const px = (n) => `${n}px`;
const pair = (p) => ({ DEFAULT: p.fg, soft: p.bg });

const fontSize = Object.fromEntries(
  Object.entries(tokens.typography.scale).map(([name, t]) => [
    name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
    [px(t.size), { lineHeight: px(t.lineHeight), letterSpacing: px(t.letterSpacing) }],
  ]),
);

module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: c.bg.canvas,
        card: { DEFAULT: c.bg.card, deep: c.bg.cardDeep, nested: c.bg.nested, alt: c.bg.alt },
        ink: {
          DEFAULT: c.bg.ink,
          pressed: c.bg.inkPressed,
          secondary: c.text.secondary,
          tertiary: c.text.tertiary,
          disabled: c.text.disabled,
          inverse: c.text.inverse,
        },
        'on-ink': c.text.onInk,
        icon: { DEFAULT: c.icon.primary, secondary: c.icon.secondary, inactive: c.icon.inactive },
        overlay: c.bg.overlay,
        scrim: c.bg.scrim,
        'tab-bar': c.bg.tabBar,
        divider: c.border.divider,
        focus: c.border.focus,
        success: pair(c.status.success),
        warning: pair(c.status.warning),
        danger: pair(c.status.danger),
        info: pair(c.status.info),
        neutral: pair(c.status.neutral),
        gray: tokens.palette.gray,
      },
      fontFamily: {
        sans: [tokens.typography.family.sans],
      },
      fontSize,
      borderRadius: Object.fromEntries(Object.entries(tokens.radius).map(([k, v]) => [k, px(v)])),
      spacing: {
        gutter: px(tokens.layout.gutter),
        'card-pad': px(tokens.layout.cardPadding),
        'card-inset': px(tokens.layout.cardInset),
        'tab-bar': px(tokens.layout.tabBar.height),
        'tab-inset': px(tokens.layout.tabBar.inset),
        touch: px(tokens.layout.touchTarget),
        'control-sm': px(tokens.layout.control.sm),
        'control-md': px(tokens.layout.control.md),
        'control-lg': px(tokens.layout.control.lg),
        'icon-btn': px(tokens.layout.iconButton.md),
        'icon-btn-sm': px(tokens.layout.iconButton.sm),
        'circle-btn': px(tokens.layout.circleButton),
        chip: px(tokens.layout.chip.height),
        'chip-icon': px(tokens.layout.chip.iconBox),
        pill: px(tokens.layout.pill.md),
        'pill-sm': px(tokens.layout.pill.sm),
        'avatar-md': px(tokens.layout.avatar.md),
        'avatar-xl': px(tokens.layout.avatar.xl),
      },
      boxShadow: {
        'tab-bar': tokens.elevation.tabBar.css,
        sheet: tokens.elevation.sheet.css,
      },
      opacity: {
        disabled: String(tokens.opacity.disabled),
        pressed: String(tokens.opacity.pressed),
      },
    },
  },
};
