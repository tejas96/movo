import type { Mat4, Vec3 } from './types';

/** Column-major 4x4 helpers (same layout as ARKit simd_float4x4 and ARCore's toMatrix). */

export const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export function mul(a: Mat4, b: Mat4): Mat4 {
  const out = [...IDENTITY] as Mat4;
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r]! * b[c * 4]! + a[4 + r]! * b[c * 4 + 1]! + a[8 + r]! * b[c * 4 + 2]! + a[12 + r]! * b[c * 4 + 3]!;
    }
  }
  return out;
}

/** Inverse of a rigid transform (rotation + translation). */
export function invertRigid(m: Mat4): Mat4 {
  // R^T
  const r: [number, number, number, number, number, number, number, number, number] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const tx = m[12];
  const ty = m[13];
  const tz = m[14];
  return [
    r[0], r[3], r[6], 0,
    r[1], r[4], r[7], 0,
    r[2], r[5], r[8], 0,
    -(r[0] * tx + r[1] * ty + r[2] * tz),
    -(r[3] * tx + r[4] * ty + r[5] * tz),
    -(r[6] * tx + r[7] * ty + r[8] * tz),
    1,
  ];
}

export function transformPoint(m: Mat4, p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

export function transformDir(m: Mat4, d: Vec3): Vec3 {
  return [
    m[0] * d[0] + m[4] * d[1] + m[8] * d[2],
    m[1] * d[0] + m[5] * d[1] + m[9] * d[2],
    m[2] * d[0] + m[6] * d[1] + m[10] * d[2],
  ];
}

export function translation(m: Mat4): Vec3 {
  return [m[12], m[13], m[14]];
}

/** Build a column-major matrix from three axis columns and a translation. */
export function fromAxes(x: Vec3, y: Vec3, z: Vec3, t: Vec3): Mat4 {
  return [x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, t[0], t[1], t[2], 1];
}

export function rotZ(rad: number): Mat4 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

export function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function dist2d(a: Vec3 | [number, number], b: Vec3 | [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * Fixed rotation that maps AR world axes (X right, Y up, Z back) onto building axes with Z up:
 * AR (x, y, z) -> BLCS (x, -z, y).
 */
export const AR_TO_UP_Z: Mat4 = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];
