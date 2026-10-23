import { palette } from './palette';

/** A foreground/background pair used by status pills. */
export interface ColorPair {
  readonly fg: string;
  readonly bg: string;
}

export interface SemanticColors {
  readonly bg: {
    /** Screen background. Mist, with the glow behind it. */
    readonly canvas: string;
    /** Cards, chips, rows. Frosted white glass over the mist. */
    readonly card: string;
    /** A tile inside a glass card: a stronger white. */
    readonly cardDeep: string;
    /** Anything placed inside a card: pills, icon boxes, inputs. Solid white. */
    readonly nested: string;
    /** Alternate screen background. Same mist. */
    readonly alt: string;
    /** Main actions: filled buttons, selected segment, call circles. */
    readonly ink: string;
    readonly inkPressed: string;
    /** Pills that float over art and photos. */
    readonly overlay: string;
    /** Dim layer under sheets. */
    readonly scrim: string;
    /** Glass tab bar fill. */
    readonly tabBar: string;
  };
  readonly text: {
    readonly primary: string;
    /** Subtitles on art cards, a step darker than secondary. */
    readonly soft: string;
    readonly secondary: string;
    readonly tertiary: string;
    readonly disabled: string;
    readonly inverse: string;
    readonly onInk: string;
  };
  readonly icon: {
    readonly primary: string;
    readonly secondary: string;
    /** Inactive tab bar icons. */
    readonly inactive: string;
    readonly onInk: string;
  };
  readonly border: {
    /** Hairline inside cards. */
    readonly divider: string;
    readonly focus: string;
    /** White rim of glass cards. */
    readonly glass: string;
  };
  /** Small accents only: unread dots, arrows in buttons, the selected tab icon. */
  readonly accent: ColorPair;
  /** Over full-bleed photos. Black and white at fixed strengths. */
  readonly overlay: {
    readonly base: string;
    readonly shade: string;
    readonly textStrong: string;
    readonly textSoft: string;
    readonly textDim: string;
    readonly glass: string;
    readonly darken: string;
  };
  readonly status: {
    readonly success: ColorPair;
    readonly warning: ColorPair;
    readonly danger: ColorPair;
    readonly info: ColorPair;
    readonly neutral: ColorPair;
  };
}

export const light: SemanticColors = {
  bg: {
    canvas: palette.mist,
    card: 'rgba(255, 255, 255, 0.5)',
    cardDeep: 'rgba(255, 255, 255, 0.75)',
    nested: palette.white,
    alt: palette.mist,
    ink: palette.ink,
    inkPressed: '#1C1B1E',
    overlay: 'rgba(255, 255, 255, 0.85)',
    scrim: 'rgba(43, 42, 46, 0.4)',
    // The mockup is white at 0.72 with a backdrop blur. Phones have no live blur here and even
    // 0.95 let scrolling text show through on Android, so the bar is solid, a hair off white.
    tabBar: '#FDFCFD',
  },
  text: {
    primary: palette.ink,
    soft: palette.gray[700],
    secondary: palette.gray[600],
    tertiary: palette.gray[500],
    disabled: palette.gray[400],
    inverse: palette.white,
    onInk: palette.white,
  },
  icon: {
    primary: palette.ink,
    secondary: palette.gray[600],
    inactive: palette.ink,
    onInk: palette.white,
  },
  border: {
    divider: 'rgba(43, 42, 46, 0.08)',
    focus: palette.orange[500],
    glass: 'rgba(255, 255, 255, 0.95)',
  },
  accent: { fg: palette.orange[500], bg: palette.orange[50] },
  overlay: {
    base: '#1C1B1E',
    shade: '#000000',
    textStrong: 'rgba(255, 255, 255, 0.82)',
    textSoft: 'rgba(255, 255, 255, 0.78)',
    textDim: 'rgba(255, 255, 255, 0.72)',
    glass: 'rgba(255, 255, 255, 0.18)',
    darken: 'rgba(0, 0, 0, 0.28)',
  },
  status: {
    success: { fg: palette.green[700], bg: palette.green[50] },
    warning: { fg: palette.amber[700], bg: palette.amber[50] },
    danger: { fg: palette.red[700], bg: palette.red[50] },
    info: { fg: palette.blue[700], bg: palette.blue[50] },
    neutral: { fg: palette.gray[700], bg: palette.gray[100] },
  },
};

export const color = { light } as const;
