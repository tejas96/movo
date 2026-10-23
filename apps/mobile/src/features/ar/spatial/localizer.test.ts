import { describe, expect, it } from 'vitest';
import { computeManualFix } from './localizer';
import { transformDir, transformPoint } from './math';
import type { Mat4 } from './types';

/** Camera at AR (1, 1.4, -2), looking along AR -Z (identity rotation). */
const CAM: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1.4, -2, 1];

describe('computeManualFix', () => {
  it('puts the camera at the target point', () => {
    const fix = computeManualFix(CAM, 90, [5, 7, 4.7]);
    const p = transformPoint(fix, [1, 1.4, -2]);
    expect(p[0]).toBeCloseTo(5, 5);
    expect(p[1]).toBeCloseTo(7, 5);
    expect(p[2]).toBeCloseTo(4.7, 5);
  });
  it('turns the camera forward to the compass heading (90 = east = +X)', () => {
    const fix = computeManualFix(CAM, 90, [0, 0, 0]);
    const f = transformDir(fix, [0, 0, -1]);
    expect(f[0]).toBeCloseTo(1, 5);
    expect(f[1]).toBeCloseTo(0, 5);
    const north = transformDir(computeManualFix(CAM, 0, [0, 0, 0]), [0, 0, -1]);
    expect(north[1]).toBeCloseTo(1, 5);
  });
  it('keeps the AR yaw when the heading is unknown', () => {
    const f = transformDir(computeManualFix(CAM, -1, [0, 0, 0]), [0, 0, -1]);
    // AR -Z maps to building +Y under the fixed axis swap
    expect(f[1]).toBeCloseTo(1, 5);
  });
});
