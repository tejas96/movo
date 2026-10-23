import type { ArLabel, ArMesh, ArMeshStyle, ArSceneJson } from '@movo/ar-native';
import type { RouteView } from '../useRoute';
import { chaikin, compact, diamond, merge, ribbon, ring, tube } from './mesh';
import { spacesOnLevel } from './model';
import type { MarkerKind, ServiceKind, ServiceSet } from './services';
import type { LevelDef, NavNode, Vec3 } from './types';

/** Which content groups the camera view draws. Shared with the 2D map. */
export interface ArLayers {
  route: boolean;
  rooms: boolean;
  water: boolean;
  drain: boolean;
  electric: boolean;
}

export const DEFAULT_LAYERS: ArLayers = {
  route: true,
  rooms: true,
  water: false,
  drain: false,
  electric: false,
};

/** Colours for the camera view, rgb 0..1. Status colours from the design system, brightened for video. */
export const SERVICE_STYLE: Record<ServiceKind, ArMeshStyle> = {
  water: {
    color: [0.24, 0.62, 1.0, 0.85],
    glow: [0.86, 0.96, 1.0],
    pattern: 'band',
    period: 0.45,
    speed: 0.9,
  },
  drain: {
    color: [0.33, 0.6, 0.54, 0.75],
    glow: [0.72, 0.92, 0.85],
    pattern: 'band',
    period: 0.6,
    speed: 0.6,
  },
  electric: {
    color: [0.95, 0.6, 0.08, 0.8],
    glow: [1.0, 0.95, 0.65],
    pattern: 'pulse',
    period: 1.4,
    speed: 2.8,
  },
};

export const ROUTE_STYLE: ArMeshStyle = {
  color: [0.14, 0.72, 0.45, 0.62],
  glow: [1, 1, 1],
  pattern: 'chevron',
  period: 0.9,
  speed: 1.1,
};

const DEST_RING: ArMeshStyle = {
  color: [0.14, 0.72, 0.45, 0.6],
  glow: [1, 1, 1],
  pattern: 'band',
  period: 0.3,
  speed: 0.35,
};
const DEST_PIN: ArMeshStyle = {
  color: [0.95, 0.6, 0.08, 0.95],
  glow: [1, 1, 1],
  pattern: 'solid',
  period: 1,
  speed: 0,
};

const MARKER_STYLE: Record<MarkerKind, ArMeshStyle> = {
  switchboard: {
    color: [0.95, 0.6, 0.08, 0.95],
    glow: [1, 1, 1],
    pattern: 'solid',
    period: 1,
    speed: 0,
  },
  db: { color: [0.95, 0.45, 0.05, 0.95], glow: [1, 1, 1], pattern: 'solid', period: 1, speed: 0 },
  light: { color: [1.0, 0.9, 0.5, 0.9], glow: [1, 1, 1], pattern: 'solid', period: 1, speed: 0 },
  sink: { color: [0.24, 0.62, 1.0, 0.95], glow: [1, 1, 1], pattern: 'solid', period: 1, speed: 0 },
  basin: { color: [0.24, 0.62, 1.0, 0.95], glow: [1, 1, 1], pattern: 'solid', period: 1, speed: 0 },
  floorTrap: {
    color: [0.33, 0.6, 0.54, 0.95],
    glow: [1, 1, 1],
    pattern: 'solid',
    period: 1,
    speed: 0,
  },
  riser: { color: [0.6, 0.6, 0.65, 0.9], glow: [1, 1, 1], pattern: 'solid', period: 1, speed: 0 },
};

/** Which markers belong to which layer. */
const MARKER_LAYER: Record<MarkerKind, keyof ArLayers> = {
  switchboard: 'electric',
  db: 'electric',
  light: 'electric',
  sink: 'water',
  basin: 'water',
  floorTrap: 'drain',
  riser: 'water',
};

const m = (p: Vec3): Vec3 => [p[0] / 1000, p[1] / 1000, p[2] / 1000];

/**
 * Static content of one level: room labels, pipes, wires, fixtures. Rebuilt per level, layer or flat change.
 * Services are shown for `focusFlat` only (the flat the phone is in) plus the shared risers, so a room does not
 * fill with the neighbours' lines seen through the walls.
 */
export function buildLevelScene(
  level: LevelDef,
  layers: ArLayers,
  services: ServiceSet,
  focusFlat: string | null = null,
): ArSceneJson {
  const meshes: ArMesh[] = [];
  const labels: ArLabel[] = [];
  const inScope = (flat: string | null) => flat === null || flat === focusFlat;

  for (const kind of ['water', 'drain', 'electric'] as const) {
    if (!layers[kind]) continue;
    const tubes: ArMesh[] = [];
    for (const line of services.lines) {
      if (line.kind !== kind || !inScope(line.flat)) continue;
      const t = tube(line.id, line.points.map(m), line.radiusMm / 1000, SERVICE_STYLE[kind]);
      if (t) tubes.push(t);
    }
    const merged = merge(`${level.id}/${kind}`, tubes);
    if (merged) meshes.push(merged);
  }

  const byKind = new Map<MarkerKind, ArMesh[]>();
  for (const mk of services.markers) {
    if (!layers[MARKER_LAYER[mk.kind]] || !inScope(mk.flat)) continue;
    const size = mk.kind === 'db' ? 0.09 : mk.kind === 'riser' ? 0.08 : 0.045;
    const d = diamond(mk.id, m(mk.p), size, MARKER_STYLE[mk.kind]);
    const list = byKind.get(mk.kind);
    if (list) list.push(d);
    else byKind.set(mk.kind, [d]);
    if (mk.kind === 'db' || mk.kind === 'riser')
      labels.push({ id: mk.id, text: mk.label, kind: 'marker', p: m(mk.p) });
  }
  for (const [kind, list] of byKind) {
    const merged = merge(`${level.id}/marker/${kind}`, list);
    if (merged) meshes.push(merged);
  }

  if (layers.rooms) {
    for (const s of spacesOnLevel(level)) {
      if (s.subtype === 'shaft' || s.subtype === 'parking_area') continue;
      labels.push({
        id: s.code,
        text: s.name,
        sub: s.flat ? `Flat ${s.flat}` : undefined,
        kind: 'room',
        p: m(s.point),
      });
    }
  }
  return { meshes, labels };
}

/** The route ribbon on this level plus the destination pin. Rebuilt when the route changes. */
export function buildRouteScene(
  routeView: RouteView | null,
  dest: NavNode | null,
  level: LevelDef,
): ArSceneJson {
  const meshes: ArMesh[] = [];
  const labels: ArLabel[] = [];
  if (routeView) {
    // the longest run of consecutive nodes on this level, 2 cm above the floor
    let run: Vec3[] = [];
    let best: Vec3[] = [];
    routeView.route.nodes.forEach((n, i) => {
      const pt = routeView.points[i];
      if (n.levelId === level.id && pt) run.push(m([pt[0], pt[1], level.elevationMm + 20]));
      else {
        if (run.length > best.length) best = run;
        run = [];
      }
    });
    if (run.length > best.length) best = run;
    const r = ribbon('route', chaikin(best, 2), 0.55, ROUTE_STYLE);
    if (r) meshes.push(r);
  }
  if (dest && dest.levelId === level.id) {
    const c = m([dest.p[0], dest.p[1], level.elevationMm + 25]);
    meshes.push(ring('dest-ring', c, 0.3, 0.55, DEST_RING));
    meshes.push(diamond('dest-pin', [c[0], c[1], c[2] + 1.0], 0.1, DEST_PIN));
    labels.push({
      id: 'dest',
      text: dest.name ?? dest.kind,
      kind: 'dest',
      p: [c[0], c[1], c[2] + 1.35],
    });
  }
  return { meshes, labels };
}

/** Compact JSON for the native prop. */
export function sceneJson(scene: ArSceneJson): string {
  return JSON.stringify({ meshes: scene.meshes.map(compact), labels: scene.labels });
}
