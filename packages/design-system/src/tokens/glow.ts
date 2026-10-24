/**
 * Soft Glow colour art. Every value is copied from the mockup (docs/design/soft-glow/source).
 *
 * Art: a base colour plus soft colour spots. Each spot is the mockup's
 * `radial-gradient(at x% y%, colour, transparent stop%)`, drawn on a box 1.7x the card
 * (the mockup's `inset: -35%`), blurred and slowly drifting.
 */
export interface ArtSpot {
  /** Centre, 0..100 of the drawing box. */
  readonly x: number;
  readonly y: number;
  readonly color: string;
  /** Where the colour fades out, 0..100 of the farthest-corner radius. */
  readonly stop: number;
}

export interface ArtPreset {
  readonly base: string;
  readonly spots: readonly ArtSpot[];
}

const s = (x: number, y: number, color: string, stop: number): ArtSpot => ({ x, y, color, stop });

export const art = {
  /** Home: your building card. */
  home: {
    base: '#EFE8EE',
    spots: [s(75, 25, '#CDB2F0', 55), s(25, 75, '#F8CDB0', 55), s(85, 85, '#F4B3C2', 55)],
  },
  /** Notices card, urgent notices. */
  rose: {
    base: '#F1E3EC',
    spots: [s(25, 35, '#F5A3C7', 50), s(75, 30, '#C9B6F2', 55), s(50, 85, '#FFD3C0', 60)],
  },
  /** Bills tile. */
  meadow: {
    base: '#F3E7DE',
    spots: [s(20, 30, '#F7B48A', 50), s(60, 55, '#A8D69F', 50), s(85, 20, '#F6C2C9', 55)],
  },
  /** Find my way tile, service notices. */
  dusk: { base: '#E3DCEB', spots: [s(40, 30, '#8FA8E0', 55), s(70, 70, '#F3A6B9', 55)] },
  /** Members card, rules notices. */
  sand: { base: '#EFEADF', spots: [s(30, 60, '#F6C7A0', 50), s(65, 35, '#D8E8C8', 55)] },
  /** Events hero. */
  flame: {
    base: '#EDE3E8',
    spots: [
      s(50, 60, '#F59A4A', 45),
      s(40, 40, '#F6D35B', 40),
      s(70, 30, '#E8B4D0', 50),
      s(20, 80, '#8FA8E0', 50),
    ],
  },
  /** Money hero. */
  sunset: {
    base: '#F4E2DA',
    spots: [s(25, 30, '#F59A4A', 50), s(75, 25, '#F5A3C7', 50), s(55, 75, '#F6D35B', 55)],
  },
  /** Pinned water notice. */
  water: {
    base: '#EEE5EE',
    spots: [s(80, 30, '#A9C2F2', 50), s(20, 30, '#F5A3C7', 50), s(50, 90, '#FFD3C0', 60)],
  },
  /** Next meeting avatar. */
  meeting: {
    base: '#E9DCE6',
    spots: [s(30, 30, '#8FA8E0', 55), s(70, 70, '#F3A6B9', 55), s(50, 90, '#F6B07A', 60)],
  },
  /** Small tiles and avatars. */
  tileBlue: { base: '#E6E1F1', spots: [s(30, 30, '#A9C2F2', 60), s(70, 70, '#CDB2F0', 60)] },
  tileFlame: { base: '#F6E7DC', spots: [s(40, 60, '#F7B48A', 60), s(70, 30, '#F6D35B', 60)] },
  tilePink: { base: '#F3E1E6', spots: [s(30, 30, '#F5A3C7', 60), s(70, 70, '#F8CDB0', 60)] },
  tileSage: { base: '#EDEADF', spots: [s(30, 60, '#BFDDB0', 60), s(70, 30, '#F6C7A0', 60)] },
} as const satisfies Record<string, ArtPreset>;

export type ArtName = keyof typeof art;

/** Soft solid tints for the round icon circles (Society grid, list rows). From the mockup. */
export const tint = {
  peach: '#FDE6DA',
  lavender: '#EEE6FB',
  sage: '#E6F1E3',
  blue: '#E6E9FA',
  sand: '#FBEBD3',
  pink: '#FBE2E2',
} as const;

export type TintName = keyof typeof tint;

/** Tints in the order a list uses them, so neighbours differ. */
export const tintCycle: readonly TintName[] = ['peach', 'lavender', 'sage', 'blue', 'sand', 'pink'];

/** One background glow blob. Sizes and offsets in dp on a 390 wide screen. */
export interface GlowBlob {
  readonly color: string;
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
  /** Placement: any two of left/right/top/bottom. */
  readonly left?: number;
  readonly right?: number;
  readonly top?: number;
  readonly bottom?: number;
  /** Drift: how far it moves (dp), how much it grows, and one full cycle in ms. */
  readonly dx: number;
  readonly dy: number;
  readonly scale: number;
  readonly period: number;
}

const b = (blob: GlowBlob) => blob;

/** Background glow under each screen. `soft` is the default for most screens. */
export const glowScene = {
  soft: [
    b({
      color: '#F4B3C2',
      width: 360,
      height: 300,
      opacity: 0.7,
      left: -120,
      bottom: -90,
      dx: 50,
      dy: -30,
      scale: 1.15,
      period: 16000,
    }),
    b({
      color: '#CDB2F0',
      width: 340,
      height: 300,
      opacity: 0.75,
      right: -120,
      bottom: -110,
      dx: -60,
      dy: -20,
      scale: 1,
      period: 18000,
    }),
  ],
  home: [
    b({
      color: '#F4B3C2',
      width: 360,
      height: 300,
      opacity: 0.7,
      left: -120,
      bottom: -90,
      dx: 50,
      dy: -30,
      scale: 1.15,
      period: 16000,
    }),
    b({
      color: '#CDB2F0',
      width: 340,
      height: 300,
      opacity: 0.75,
      right: -120,
      bottom: -110,
      dx: -60,
      dy: -20,
      scale: 1,
      period: 18000,
    }),
    b({
      color: '#F8CDB0',
      width: 260,
      height: 220,
      opacity: 0.55,
      left: 60,
      bottom: 160,
      dx: 60,
      dy: 20,
      scale: 1,
      period: 20000,
    }),
  ],
  warm: [
    b({
      color: '#F8CDB0',
      width: 360,
      height: 300,
      opacity: 0.75,
      left: -120,
      bottom: -90,
      dx: 50,
      dy: -30,
      scale: 1.15,
      period: 16000,
    }),
    b({
      color: '#F4B3C2',
      width: 340,
      height: 300,
      opacity: 0.7,
      right: -120,
      bottom: -110,
      dx: -60,
      dy: -20,
      scale: 1,
      period: 18000,
    }),
  ],
  lavender: [
    b({
      color: '#CDB2F0',
      width: 360,
      height: 300,
      opacity: 0.75,
      left: -120,
      bottom: -90,
      dx: 50,
      dy: -30,
      scale: 1.15,
      period: 16000,
    }),
    b({
      color: '#F4B3C2',
      width: 340,
      height: 300,
      opacity: 0.7,
      right: -120,
      bottom: -110,
      dx: -60,
      dy: -20,
      scale: 1,
      period: 18000,
    }),
  ],
  alert: [
    b({
      color: '#F6A7A0',
      width: 360,
      height: 320,
      opacity: 0.7,
      left: -120,
      top: 220,
      dx: 50,
      dy: -30,
      scale: 1.15,
      period: 14000,
    }),
    b({
      color: '#F4B3C2',
      width: 340,
      height: 300,
      opacity: 0.7,
      right: -120,
      bottom: -110,
      dx: -60,
      dy: -20,
      scale: 1,
      period: 16000,
    }),
  ],
} as const satisfies Record<string, readonly GlowBlob[]>;

export type GlowSceneName = keyof typeof glowScene;

/** The glossy brand orb: radial gradient centred up-left, as in the mockup. */
export const orb = {
  center: { x: 0.34, y: 0.28 },
  stops: [
    { offset: 0, color: '#FFF3EC' },
    { offset: 0.16, color: '#FBB59D' },
    { offset: 0.46, color: '#F0735A' },
    { offset: 0.76, color: '#D9465A' },
    { offset: 1, color: '#B8457A' },
  ],
  shadow: 'rgba(217, 70, 90, 0.32)',
  /** The red alert orb on the Emergency screen. */
  alert: [
    { offset: 0, color: '#FFE9E4' },
    { offset: 0.16, color: '#FF9C8A' },
    { offset: 0.48, color: '#EE4B3F' },
    { offset: 0.78, color: '#C8242E' },
    { offset: 1, color: '#9E1B3A' },
  ],
} as const;

/** Fine dot texture behind greetings. */
export const dots = { gap: 9, radius: 1, color: 'rgba(43, 42, 46, 0.12)' } as const;

export const glow = { art, scene: glowScene, orb, dots } as const;
