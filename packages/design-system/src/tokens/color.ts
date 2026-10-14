import { palette } from './palette';

/** A foreground/background pair used by status pills. */
export interface ColorPair {
  readonly fg: string;
  readonly bg: string;
}

export interface SemanticColors {
  readonly bg: {
    /** Screen background. White. */
    readonly canvas: string;
    /** Cards, chips, search bar, tiles, icon squares. Soft gray. */
    readonly card: string;
    /** A tile inside a gray card: one step darker gray. */
    readonly cardDeep: string;
    /** Anything placed inside a gray card: pills, icon boxes, rows. White. */
    readonly nested: string;
    /** Alternate screen background for detail screens that use a white content card. */
    readonly alt: string;
    /** Primary actions: filled buttons, active tab pill, filter square, call circles. */
    readonly ink: string;
    readonly inkPressed: string;
    /** Pills that float over photos. */
    readonly overlay: string;
    /** Dim layer under sheets. */
    readonly scrim: string;
    /** Floating tab bar background (blur behind it). */
    readonly tabBar: string;
  };
  readonly text: {
    readonly primary: string;
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
    /** 1px separator inside cards. */
    readonly divider: string;
    readonly focus: string;
  };
  /**
   * Over full-bleed photos (Welcome, sign-in, Home, Pending). Not new colours: black and white
   * at the strengths those screens already used, so the photo stays the only colour.
   */
  readonly overlay: {
    /** Behind a full-screen photo before it paints. */
    readonly base: string;
    /** Gradient shade on photos; each gradient stop sets its own opacity. */
    readonly shade: string;
    /** White text on a photo, from strongest to dimmest. */
    readonly textStrong: string;
    readonly textSoft: string;
    readonly textDim: string;
    /** Glass fill for a small control on a photo (Skip). */
    readonly glass: string;
    /** Dark layer that fills a black HoldButton while it is held. */
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
    canvas: palette.white,
    card: palette.gray[100],
    cardDeep: palette.gray[200],
    nested: palette.white,
    alt: '#F6F6F6',
    ink: palette.black,
    inkPressed: '#000000',
    overlay: 'rgba(255, 255, 255, 0.92)',
    scrim: 'rgba(17, 17, 17, 0.45)',
    tabBar: 'rgba(255, 255, 255, 0.88)',
  },
  text: {
    primary: palette.black,
    secondary: '#767676',
    tertiary: '#AFAFAF',
    disabled: '#C8C8C8',
    inverse: palette.white,
    onInk: palette.white,
  },
  icon: {
    primary: palette.black,
    secondary: '#6F6F6F',
    inactive: '#5C5C5C',
    onInk: palette.white,
  },
  border: {
    divider: '#EAEAEA',
    focus: palette.black,
  },
  overlay: {
    base: '#111111',
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
    neutral: { fg: palette.gray[700], bg: palette.gray[200] },
  },
};

export const color = { light } as const;
