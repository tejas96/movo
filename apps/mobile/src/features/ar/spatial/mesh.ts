import type { ArMesh, ArMeshStyle } from '@movo/ar-native';
import type { Vec3 } from './types';

/**
 * Mesh builders for the AR scene. Everything here is plain geometry in building metres, Z up.
 * The native side only uploads these buffers and runs the pattern shaders, so both platforms draw
 * exactly the same shapes.
 */

const UP: Vec3 = [0, 0, 1];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
function unit(a: Vec3, fallback: Vec3 = [1, 0, 0]): Vec3 {
  const l = length(a);
  return l < 1e-9 ? fallback : scale(a, 1 / l);
}
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Drops repeated points so tangents are never zero. */
export function dedupe(points: Vec3[], eps = 1e-4): Vec3[] {
  const out: Vec3[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || length(sub(p, last)) > eps) out.push(p);
  }
  return out;
}

/** Chaikin corner cutting: rounds the corners of a polyline, keeps both ends. */
export function chaikin(points: Vec3[], iterations = 1): Vec3[] {
  let pts = points;
  for (let k = 0; k < iterations; k++) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (pts.length < 3 || !first || !last) return pts;
    const out: Vec3[] = [first];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (!a || !b) continue;
      out.push(lerp(a, b, 0.25), lerp(a, b, 0.75));
    }
    out.push(last);
    pts = out;
  }
  return pts;
}

/** Tangent at point i: average of the two neighbouring segments. */
function tangents(pts: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i] ?? [0, 0, 0];
    const prev = pts[i - 1] ?? p;
    const next = pts[i + 1] ?? p;
    out.push(unit(sub(next, prev)));
  }
  return out;
}

/** Flat strip along a polyline, lying in the XY plane. Lateral param runs -1 (left) to +1 (right). */
export function ribbon(
  id: string,
  points: Vec3[],
  widthM: number,
  style: ArMeshStyle,
): ArMesh | null {
  const pts = dedupe(points);
  if (pts.length < 2) return null;
  const tan = tangents(pts);
  const positions: number[] = [];
  const normals: number[] = [];
  const params: number[] = [];
  const indices: number[] = [];
  let dist = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const t = tan[i];
    if (!p || !t) continue;
    const prev = pts[i - 1];
    if (prev) dist += length(sub(p, prev));
    const flat: Vec3 = unit([t[0], t[1], 0], [1, 0, 0]);
    const side = unit(cross(flat, UP), [0, 1, 0]);
    const l = add(p, scale(side, -widthM / 2));
    const r = add(p, scale(side, widthM / 2));
    positions.push(l[0], l[1], l[2], r[0], r[1], r[2]);
    normals.push(0, 0, 1, 0, 0, 1);
    params.push(dist, -1, dist, 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return { id, style, positions, normals, params, indices };
}

/** Round pipe along a polyline. Lateral param is the angle around the tube, 0..1. */
export function tube(
  id: string,
  points: Vec3[],
  radiusM: number,
  style: ArMeshStyle,
  sides = 6,
): ArMesh | null {
  const pts = dedupe(points);
  if (pts.length < 2) return null;
  const tan = tangents(pts);
  const positions: number[] = [];
  const normals: number[] = [];
  const params: number[] = [];
  const indices: number[] = [];
  let n: Vec3 | null = null;
  let dist = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const t = tan[i];
    if (!p || !t) continue;
    const prev = pts[i - 1];
    if (prev) dist += length(sub(p, prev));
    // parallel transport of the frame, so the tube does not twist at bends
    if (!n) n = unit(cross(t, Math.abs(t[2]) < 0.9 ? UP : [1, 0, 0]), [0, 1, 0]);
    else n = unit(sub(n, scale(t, dot(n, t))), unit(cross(t, UP), [0, 1, 0]));
    const b = cross(t, n);
    for (let j = 0; j < sides; j++) {
      const a = (2 * Math.PI * j) / sides;
      const r = add(scale(n, Math.cos(a)), scale(b, Math.sin(a)));
      const v = add(p, scale(r, radiusM));
      positions.push(v[0], v[1], v[2]);
      normals.push(r[0], r[1], r[2]);
      params.push(dist, j / sides);
    }
    if (i > 0) {
      const ring0 = (i - 1) * sides;
      const ring1 = i * sides;
      for (let j = 0; j < sides; j++) {
        const k = (j + 1) % sides;
        indices.push(ring0 + j, ring1 + j, ring0 + k, ring0 + k, ring1 + j, ring1 + k);
      }
    }
  }
  return { id, style, positions, normals, params, indices };
}

/** Small upright diamond (octahedron stretched along Z). Used for fixtures and boards. */
export function diamond(id: string, c: Vec3, sizeM: number, style: ArMeshStyle): ArMesh {
  const s = sizeM;
  const h = sizeM * 1.6;
  const v: Vec3[] = [
    [c[0] + s, c[1], c[2]],
    [c[0], c[1] + s, c[2]],
    [c[0] - s, c[1], c[2]],
    [c[0], c[1] - s, c[2]],
    [c[0], c[1], c[2] + h],
    [c[0], c[1], c[2] - h],
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const params: number[] = [];
  for (const p of v) {
    positions.push(p[0], p[1], p[2]);
    const nrm = unit(sub(p, c));
    normals.push(nrm[0], nrm[1], nrm[2]);
    params.push(0, 0);
  }
  const indices = [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4, 1, 0, 5, 2, 1, 5, 3, 2, 5, 0, 3, 5];
  return { id, style, positions, normals, params, indices };
}

/** Flat ring on the floor around a point. Distance param grows outwards, so a band pattern ripples out. */
export function ring(
  id: string,
  c: Vec3,
  innerM: number,
  outerM: number,
  style: ArMeshStyle,
  segments = 28,
): ArMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const params: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    positions.push(c[0] + ca * innerM, c[1] + sa * innerM, c[2]);
    positions.push(c[0] + ca * outerM, c[1] + sa * outerM, c[2]);
    normals.push(0, 0, 1, 0, 0, 1);
    params.push(0, -1, outerM - innerM, 1);
    if (i > 0) {
      const k = (i - 1) * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  return { id, style, positions, normals, params, indices };
}

/** Joins meshes that share a style into one draw call. */
export function merge(id: string, meshes: ArMesh[]): ArMesh | null {
  const first = meshes[0];
  if (!first) return null;
  const out: ArMesh = {
    id,
    style: first.style,
    positions: [],
    normals: [],
    params: [],
    indices: [],
  };
  for (const m of meshes) {
    const base = out.positions.length / 3;
    for (const x of m.positions) out.positions.push(x);
    for (const x of m.normals) out.normals.push(x);
    for (const x of m.params) out.params.push(x);
    for (const x of m.indices) out.indices.push(x + base);
  }
  return out;
}

/** Rounds every number so the JSON stays small. Positions to 1 mm, normals to 0.01. */
export function compact(m: ArMesh): ArMesh {
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const r2 = (x: number) => Math.round(x * 100) / 100;
  return {
    ...m,
    positions: m.positions.map(r3),
    normals: m.normals.map(r2),
    params: m.params.map(r3),
  };
}
