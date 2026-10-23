import { describe, expect, it } from 'vitest';
import type { DevicePose, NavNode } from './spatial/types';
import { bearingDeg, stepInfo, turnFor } from './steps';

const node = (id: string, p: [number, number]): NavNode => ({
  id,
  levelId: 'L1',
  p,
  kind: 'space',
  space: null,
  name: id,
});

describe('steps', () => {
  it('bearing is 0 to the north and 90 to the east', () => {
    expect(bearingDeg([0, 0], [0, 10])).toBe(0);
    expect(bearingDeg([0, 0], [10, 0])).toBe(90);
    expect(bearingDeg([0, 0], [0, -10])).toBe(180);
  });
  it('turns', () => {
    expect(turnFor(10)).toBe('straight');
    expect(turnFor(-10)).toBe('straight');
    expect(turnFor(80)).toBe('right');
    expect(turnFor(-80)).toBe('left');
    expect(turnFor(170)).toBe('back');
    expect(turnFor(350)).toBe('straight');
  });
  it('step from a pose facing north to a node in the east says turn right', () => {
    const a = node('a', [0, 0]);
    const b = node('b', [3000, 0]);
    const c = node('c', [3000, 4000]);
    const pose: DevicePose = {
      levelId: 'L1',
      x: 0,
      y: 0,
      z: 0,
      yawDeg: 0,
      confidence: 0.9,
      fixSource: null,
      lastFixAgeS: 0,
      distanceSinceFixM: 0,
    };
    const rv = {
      route: { nodes: [a, b, c], totalS: 12, totalMm: 7000 },
      points: [],
      next: b,
    };
    const s = stepInfo(pose, rv);
    expect(s?.turn).toBe('right');
    expect(s?.distM).toBe(3);
    expect(s?.after?.id).toBe('c');
    expect(stepInfo(null, rv)?.turn).toBeNull();
    expect(stepInfo(pose, null)).toBeNull();
  });
});
