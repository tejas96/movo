import raw from '../data/building.json';
import type { BuildingModel, LevelDef, SpaceDef, Vec3 } from './types';

/** The building model. Copied from docs/spatial/laxmi-pushp.building.json by docs/spatial/tools/make_plates.py. */
export const model = raw as unknown as BuildingModel;

export const levels: LevelDef[] = model.building.levels.filter((l) => l.template);

export function levelById(id: string | null | undefined): LevelDef | undefined {
  return id ? levels.find((l) => l.id === id) : undefined;
}

/** Flat number on a level: typical position "03" on level 4 is "403"; sixth and ground keep their own codes. */
export function flatLabel(level: LevelDef, position: string | null): string | null {
  if (!position) return null;
  if (level.template === 'TYP') return `${level.index}${position}`;
  return position;
}

export interface LabelledSpace {
  code: string;
  name: string;
  subtype: string;
  flat: string | null;
  /** BLCS mm, label height 1.2 m above the finished floor */
  point: Vec3;
  polygon: number[][];
}

const WALKABLE = new Set(['living', 'kitchen', 'bedroom', 'toilet', 'passage', 'corridor', 'balcony', 'terrace', 'lift', 'stair', 'shaft', 'parking_area', 'unknown']);

function centroid(P: number[][]): [number, number] {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < P.length; i++) {
    const [x0 = 0, y0 = 0] = P[i] ?? [];
    const [x1 = 0, y1 = 0] = P[(i + 1) % P.length] ?? [];
    const cr = x0 * y1 - x1 * y0;
    a += cr;
    cx += (x0 + x1) * cr;
    cy += (y0 + y1) * cr;
  }
  if (Math.abs(a) < 1e-6) return [P[0]?.[0] ?? 0, P[0]?.[1] ?? 0];
  return [cx / (3 * a), cy / (3 * a)];
}

/** Spaces of a level with their label points, instance codes and flat numbers. */
export function spacesOnLevel(level: LevelDef): LabelledSpace[] {
  const tpl = level.template ? model.building.templates[level.template] : undefined;
  if (!tpl) return [];
  const out: LabelledSpace[] = [];
  for (const s of tpl.spaces as SpaceDef[]) {
    if (!WALKABLE.has(s.subtype)) continue;
    const c = centroid(s.geometry.coords);
    const code = instanceCode(s.code, level);
    out.push({
      code,
      name: s.name,
      subtype: s.subtype,
      flat: flatLabel(level, s.flatPosition),
      point: [c[0], c[1], level.elevationMm + 1200],
      polygon: s.geometry.coords,
    });
  }
  return out;
}

export function instanceCode(code: string, level: LevelDef): string {
  if (code.includes('/TYP/')) {
    return code.replace('/TYP/', `/${level.id}/`).replace(/\/F(0[1-5])\//, (_m, pos: string) => `/F${level.index}${pos}/`);
  }
  if (code.includes('/SIXTH/')) return code.replace('/SIXTH/', '/L6/');
  if (code.includes('/GF/')) return code.replace('/GF/', '/L0/');
  return code;
}

/** Point-in-polygon on the level plan (mm). */
export function spaceAt(level: LevelDef, x: number, y: number): LabelledSpace | null {
  for (const s of spacesOnLevel(level)) {
    if (pip(x, y, s.polygon)) return s;
  }
  return null;
}

function pip(x: number, y: number, P: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi = 0, yi = 0] = P[i] ?? [];
    const [xj = 0, yj = 0] = P[j] ?? [];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
