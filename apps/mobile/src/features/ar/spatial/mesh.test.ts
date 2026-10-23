import { describe, expect, it } from 'vitest';
import { chaikin, compact, dedupe, diamond, merge, ribbon, ring, tube } from './mesh';
import type { Vec3 } from './types';

const style = {
  color: [1, 1, 1, 1] as [number, number, number, number],
  glow: [1, 1, 1] as [number, number, number],
  pattern: 'solid' as const,
  period: 1,
  speed: 0,
};
const L: Vec3[] = [
  [0, 0, 0],
  [2, 0, 0],
  [2, 3, 0],
];

describe('mesh', () => {
  it('dedupes repeated points', () => {
    expect(
      dedupe([
        [0, 0, 0],
        [0, 0, 0],
        [1, 0, 0],
      ]).length,
    ).toBe(2);
  });
  it('chaikin keeps the ends and rounds the corner', () => {
    const c = chaikin(L, 1);
    expect(c[0]).toEqual([0, 0, 0]);
    expect(c[c.length - 1]).toEqual([2, 3, 0]);
    expect(c.length).toBe(6);
  });
  it('ribbon has two vertices per point and a quad per segment', () => {
    const r = ribbon('r', L, 0.5, style);
    expect(r).not.toBeNull();
    expect(r?.positions.length).toBe(3 * 2 * 3);
    expect(r?.indices.length).toBe(6 * 2);
    // first pair is 0.5 m apart, across the first segment (which runs along +X)
    expect(r?.positions.slice(0, 6)).toEqual([0, 0.25, 0, 0, -0.25, 0]);
    // distance param grows along the line
    expect(r?.params[4]).toBeCloseTo(2);
    expect(r?.params[8]).toBeCloseTo(5);
  });
  it('ribbon needs two distinct points', () => {
    expect(ribbon('r', [[0, 0, 0]], 1, style)).toBeNull();
  });
  it('tube rings have unit normals and stay the given radius from the line', () => {
    const t = tube('t', L, 0.02, style, 6);
    expect(t).not.toBeNull();
    if (!t) return;
    expect(t.positions.length).toBe(3 * 6 * 3);
    for (let i = 0; i < 6; i++) {
      const x = t.positions[i * 3] ?? 0;
      const y = t.positions[i * 3 + 1] ?? 0;
      const z = t.positions[i * 3 + 2] ?? 0;
      expect(Math.hypot(x, y, z)).toBeCloseTo(0.02, 5);
      const n = Math.hypot(
        t.normals[i * 3] ?? 0,
        t.normals[i * 3 + 1] ?? 0,
        t.normals[i * 3 + 2] ?? 0,
      );
      expect(n).toBeCloseTo(1, 5);
    }
    expect(t.indices.length).toBe(2 * 6 * 6);
    expect(Math.max(...t.indices)).toBe(17);
  });
  it('diamond and ring are closed meshes', () => {
    expect(diamond('d', [0, 0, 0], 0.1, style).indices.length).toBe(24);
    const rg = ring('g', [0, 0, 0], 0.3, 0.5, style, 8);
    expect(rg.positions.length).toBe(9 * 2 * 3);
    expect(rg.indices.length).toBe(8 * 6);
  });
  it('merge offsets indices', () => {
    const a = diamond('a', [0, 0, 0], 0.1, style);
    const b = diamond('b', [1, 0, 0], 0.1, style);
    const mm = merge('m', [a, b]);
    expect(mm?.positions.length).toBe(36);
    expect(mm?.indices.slice(24).map((i) => i - 6)).toEqual(b.indices);
    expect(merge('e', [])).toBeNull();
  });
  it('compact rounds to millimetres', () => {
    const c = compact(diamond('a', [0.12345, 0, 0], 0.1, style));
    expect(c.positions[0]).toBe(0.223);
  });
});
