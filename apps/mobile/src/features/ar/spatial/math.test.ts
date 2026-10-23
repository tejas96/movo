import { describe, expect, it } from 'vitest';
import { AR_TO_UP_Z, IDENTITY, invertRigid, mul, rotZ, transformPoint } from './math';
import type { Mat4 } from './types';

describe('math', () => {
  it('invertRigid undoes a rotation plus translation', () => {
    const R = mul(rotZ(0.7), AR_TO_UP_Z);
    const m: Mat4 = [...R] as Mat4;
    m[12] = 1.5;
    m[13] = -2;
    m[14] = 4.7;
    const inv = invertRigid(m);
    const id = mul(m, inv);
    for (let i = 0; i < 16; i++) expect(id[i]).toBeCloseTo(IDENTITY[i] ?? 0, 6);
    // a point 0.2 m below the camera in the building stays 0.2 m below it in AR (AR y is up)
    const camB = transformPoint(m, [0, 0, 0]);
    const below = transformPoint(inv, [camB[0], camB[1], camB[2] - 0.2]);
    expect(below[0]).toBeCloseTo(0, 6);
    expect(below[1]).toBeCloseTo(-0.2, 6);
    expect(below[2]).toBeCloseTo(0, 6);
  });
});
