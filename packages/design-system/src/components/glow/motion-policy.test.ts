import { describe, expect, it } from 'vitest';
import { loopMode, loopRuns, SETTLE_MS, settleRepeats } from './motion-policy';

describe('loopRuns (glow, art, orb, ripple: still unless asked)', () => {
  it('is off when nobody asks for motion', () => {
    expect(loopRuns({ reduced: false })).toBe(false);
  });
  it('runs when a caller asks for it', () => {
    expect(loopRuns({ animate: true, reduced: false })).toBe(true);
  });
  it('stays off when the phone asks for less motion, even if asked', () => {
    expect(loopRuns({ animate: true, reduced: true })).toBe(false);
  });
  it('stays off when the caller says no', () => {
    expect(loopRuns({ animate: false, reduced: false })).toBe(false);
  });
});

describe('loopMode (drawings: play, then rest)', () => {
  it('plays for a while and then rests when nobody says', () => {
    expect(loopMode({ reduced: false })).toBe('settle');
  });
  it('loops for good only when a caller asks', () => {
    expect(loopMode({ animate: true, reduced: false })).toBe('forever');
  });
  it('is still when the caller says no', () => {
    expect(loopMode({ animate: false, reduced: false })).toBe('off');
  });
  it('is still when the phone asks for less motion, whatever the caller says', () => {
    expect(loopMode({ reduced: true })).toBe('off');
    expect(loopMode({ animate: true, reduced: true })).toBe('off');
  });
});

describe('settleRepeats', () => {
  it('covers about SETTLE_MS of motion', () => {
    expect(SETTLE_MS).toBe(4000);
    expect(settleRepeats(1000, false)).toBe(4);
    expect(settleRepeats(1500, false)).toBe(3);
  });
  it('always plays at least once', () => {
    expect(settleRepeats(6000, false)).toBe(1);
  });
  it('gives an even count for there-and-back loops, so they end where they started', () => {
    expect(settleRepeats(1200, true)).toBe(4);
    expect(settleRepeats(2500, true)).toBe(2);
    expect(settleRepeats(900, true) % 2).toBe(0);
    expect(settleRepeats(5000, true)).toBe(2);
  });
});
