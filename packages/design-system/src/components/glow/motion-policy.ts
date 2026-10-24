/**
 * When looping motion runs. A running loop redraws the screen every frame for as long as it is
 * mounted; with loops everywhere the app sat at full CPU while idle. So:
 * - the big blurred layers (glow, card art) and the orb are still unless a caller asks;
 * - drawings play for about SETTLE_MS when they appear, then rest;
 * - only a caller that asks (animate: true) loops for good, e.g. the Emergency pulses.
 * The phone's reduced-motion setting always wins.
 */

/** How long a drawing plays before it rests, in ms. */
export const SETTLE_MS = 4000;

export type LoopMode = 'off' | 'settle' | 'forever';

/** Glow, art, orb and ripple: run only when asked. */
export function loopRuns({ animate, reduced }: { animate?: boolean; reduced: boolean }): boolean {
  return animate === true && !reduced;
}

/** Drawings: undefined = play then rest, true = forever, false = still. */
export function loopMode({ animate, reduced }: { animate?: boolean; reduced: boolean }): LoopMode {
  if (reduced || animate === false) return 'off';
  return animate === true ? 'forever' : 'settle';
}

/**
 * Repeats that fill about SETTLE_MS, at least one. `there` loops (0 → 1 → 0) need an even count
 * so they end back at 0, where the drawing rests.
 */
export function settleRepeats(stepMs: number, thereAndBack: boolean): number {
  const n = Math.max(1, Math.round(SETTLE_MS / stepMs));
  return thereAndBack ? Math.max(2, n + (n % 2)) : n;
}
