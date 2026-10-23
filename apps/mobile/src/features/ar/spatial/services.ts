import { centroid, type LabelledSpace, model, spacesOnLevel } from './model';
import type { LevelDef, NavNode, Vec3 } from './types';

/**
 * Hidden services: water supply, drainage and electrical conduits, per level.
 *
 * The drawings give fixture and switch-board positions but no pipe or conduit routes
 * (docs/09 section 1.7). The lines here follow the normal practice for this kind of building:
 * risers in the plumbing ducts, branches at ceiling level, drops to the fixtures; conduits from the
 * flat's distribution board through the slab to each room. Every line is marked `inferred`.
 * A route survey can replace a line with `surveyed`; the look stays the same.
 */

export type ServiceKind = 'water' | 'drain' | 'electric';
export type MarkerKind = 'switchboard' | 'db' | 'sink' | 'basin' | 'floorTrap' | 'light' | 'riser';
export type ServiceConfidence = 'inferred' | 'documented' | 'surveyed';

export interface ServiceLine {
  id: string;
  kind: ServiceKind;
  levelId: string;
  /** BLCS mm, in flow direction: supply runs shaft -> fixture, drain runs fixture -> shaft */
  points: Vec3[];
  radiusMm: number;
  flat: string | null;
  confidence: ServiceConfidence;
}

export interface ServiceMarker {
  id: string;
  kind: MarkerKind;
  levelId: string;
  p: Vec3;
  label: string;
  flat: string | null;
  confidence: ServiceConfidence;
}

export interface ServiceSet {
  lines: ServiceLine[];
  markers: ServiceMarker[];
}

/** Heights above the finished floor (mm). From the electrical schedule and docs/09 section 1.10. */
export const H = {
  /** conduits run in the slab just under the ceiling */
  ceiling: 2900,
  /** concealed water branches */
  waterBranch: 2300,
  /** basin, sink, mixer: 32 in */
  fixture: 800,
  /** switch board centre: 1500 to top */
  board: 1400,
  /** distribution board on the loft: 2750 to top */
  db: 2600,
  /** drain runs in the sunk slab, just below this floor */
  drainRun: -250,
  /** slab thickness */
  slab: -150,
} as const;

const ELECTRIC_ROOMS = new Set(['living', 'kitchen', 'bedroom', 'toilet', 'passage', 'unknown']);
const WET_ROOMS = new Set(['kitchen', 'toilet']);

type XY = [number, number];

function manhattan(a: XY, b: XY, z: number): Vec3[] {
  const out: Vec3[] = [[a[0], a[1], z]];
  if (a[0] !== b[0]) out.push([b[0], a[1], z]);
  if (a[1] !== b[1]) out.push([b[0], b[1], z]);
  return out;
}

function towards(from: XY, to: XY, mm: number): XY {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const l = Math.hypot(dx, dy) || 1;
  return [from[0] + (dx / l) * mm, from[1] + (dy / l) * mm];
}

const xy = (s: LabelledSpace): XY => [s.point[0], s.point[1]];
const d2 = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1]);

interface Shaft {
  name: string;
  p: XY;
  electric: boolean;
}

/** Shaft centres. The core is the same on every level, so the typical floor stands in where a level has none. */
function shaftsFor(spaces: LabelledSpace[]): Shaft[] {
  const own = spaces.filter((s) => s.subtype === 'shaft');
  if (own.length > 0)
    return own.map((s) => ({ name: s.name, p: xy(s), electric: /VENT/i.test(s.code) }));
  const typ = model.building.templates.TYP;
  if (!typ) return [];
  return typ.spaces
    .filter((s) => s.subtype === 'shaft')
    .map((s) => ({
      name: s.name,
      p: centroid(s.geometry.coords),
      electric: /VENT/i.test(s.code),
    }));
}

/** Door nodes linked to each space on a level, by instance code. */
function doorsByspace(levelId: string): Map<string, NavNode[]> {
  const nodes = new Map(model.building.nav.nodes.map((n) => [n.id, n]));
  const out = new Map<string, NavNode[]>();
  for (const e of model.building.nav.edges) {
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b || a.levelId !== levelId) continue;
    const door = a.kind === 'door' ? a : b.kind === 'door' ? b : null;
    const space = a.kind === 'space' ? a : b.kind === 'space' ? b : null;
    if (!door || !space?.space) continue;
    const list = out.get(space.space);
    if (list) list.push(door);
    else out.set(space.space, [door]);
  }
  return out;
}

function nearest<T extends { p: XY }>(items: T[], to: XY): T | null {
  let best: T | null = null;
  let bd = Infinity;
  for (const it of items) {
    const d = d2(it.p, to);
    if (d < bd) {
      bd = d;
      best = it;
    }
  }
  return best;
}

/** Water, drain and electric lines plus their fixtures for one level. Deterministic. */
export function servicesOnLevel(level: LevelDef): ServiceSet {
  const lines: ServiceLine[] = [];
  const markers: ServiceMarker[] = [];
  const z0 = level.elevationMm;
  const z = (h: number) => z0 + h;
  const spaces = spacesOnLevel(level);
  const shafts = shaftsFor(spaces);
  const plumbing = shafts.filter((s) => !s.electric);
  const electricShaft = shafts.find((s) => s.electric) ?? shafts[0] ?? null;
  const lobby = spaces.find((s) => s.subtype === 'corridor') ?? null;
  const doors = doorsByspace(level.id);
  const conf: ServiceConfidence = 'inferred';

  // vertical risers and stacks through this level
  for (const s of shafts) {
    const tag = s.name.replace(/\s+/g, '_').toUpperCase();
    if (s.electric) {
      lines.push({
        id: `${level.id}/${tag}/ELECTRIC_RISER`,
        kind: 'electric',
        levelId: level.id,
        points: [
          [s.p[0], s.p[1], z(H.slab)],
          [s.p[0], s.p[1], z(H.ceiling)],
        ],
        radiusMm: 25,
        flat: null,
        confidence: conf,
      });
    } else {
      const w: XY = [s.p[0] - 200, s.p[1]];
      const d: XY = [s.p[0] + 200, s.p[1]];
      lines.push({
        id: `${level.id}/${tag}/WATER_RISER`,
        kind: 'water',
        levelId: level.id,
        points: [
          [w[0], w[1], z(H.slab)],
          [w[0], w[1], z(H.ceiling)],
        ],
        radiusMm: 20,
        flat: null,
        confidence: conf,
      });
      lines.push({
        id: `${level.id}/${tag}/DRAIN_STACK`,
        kind: 'drain',
        levelId: level.id,
        points: [
          [d[0], d[1], z(H.ceiling)],
          [d[0], d[1], z(H.drainRun - 50)],
        ],
        radiusMm: 50,
        flat: null,
        confidence: conf,
      });
    }
    markers.push({
      id: `${level.id}/${tag}/RISER`,
      kind: 'riser',
      levelId: level.id,
      p: [s.p[0], s.p[1], z(1500)],
      label: s.name,
      flat: null,
      confidence: conf,
    });
  }

  // wet rooms: supply from the nearest plumbing shaft, drain back to it
  for (const room of spaces) {
    if (!WET_ROOMS.has(room.subtype)) continue;
    const shaft = nearest(plumbing, xy(room));
    if (!shaft) continue;
    const c = xy(room);
    const w: XY = [shaft.p[0] - 200, shaft.p[1]];
    const d: XY = [shaft.p[0] + 200, shaft.p[1]];
    lines.push({
      id: `${room.code}/WATER`,
      kind: 'water',
      levelId: level.id,
      points: [...manhattan(w, c, z(H.waterBranch)), [c[0], c[1], z(H.fixture)]],
      radiusMm: 16,
      flat: room.flat,
      confidence: conf,
    });
    lines.push({
      id: `${room.code}/DRAIN`,
      kind: 'drain',
      levelId: level.id,
      points: [[c[0], c[1], z(0)], ...manhattan(c, d, z(H.drainRun))],
      radiusMm: 40,
      flat: room.flat,
      confidence: conf,
    });
    markers.push({
      id: `${room.code}/FIXTURE`,
      kind: room.subtype === 'kitchen' ? 'sink' : 'basin',
      levelId: level.id,
      p: [c[0], c[1], z(H.fixture)],
      label: room.subtype === 'kitchen' ? 'Sink' : 'Basin',
      flat: room.flat,
      confidence: conf,
    });
    markers.push({
      id: `${room.code}/TRAP`,
      kind: 'floorTrap',
      levelId: level.id,
      p: [c[0], c[1], z(20)],
      label: 'Floor trap',
      flat: room.flat,
      confidence: conf,
    });
  }

  // electric: one distribution board per flat at its entrance, conduits in the slab to every room
  const flats = new Map<string, LabelledSpace[]>();
  for (const s of spaces) {
    if (!s.flat) continue;
    const list = flats.get(s.flat);
    if (list) list.push(s);
    else flats.set(s.flat, [s]);
  }
  for (const [flat, rooms] of flats) {
    const entrance = findEntrance(rooms, doors, lobby);
    const anchorRoom =
      (lobby
        ? nearest(
            rooms.map((r) => ({ p: xy(r), r })),
            xy(lobby),
          )?.r
        : undefined) ?? rooms[0];
    if (!anchorRoom) continue;
    const db: XY = entrance ? towards(entrance, xy(anchorRoom), 400) : xy(anchorRoom);
    markers.push({
      id: `${level.id}/F${flat}/DB`,
      kind: 'db',
      levelId: level.id,
      p: [db[0], db[1], z(H.db)],
      label: `DB ${flat}`,
      flat,
      confidence: conf,
    });
    if (electricShaft) {
      lines.push({
        id: `${level.id}/F${flat}/FEED`,
        kind: 'electric',
        levelId: level.id,
        points: [...manhattan(electricShaft.p, db, z(H.ceiling)), [db[0], db[1], z(H.db)]],
        radiusMm: 18,
        flat,
        confidence: conf,
      });
    }
    for (const room of rooms) {
      if (!ELECTRIC_ROOMS.has(room.subtype)) continue;
      const c = xy(room);
      const door = doors.get(room.code)?.[0];
      const board: XY | null = door ? towards([door.p[0], door.p[1]], c, 350) : null;
      const points: Vec3[] = [[db[0], db[1], z(H.db)], ...manhattan(db, c, z(H.ceiling))];
      if (board)
        points.push(...manhattan(c, board, z(H.ceiling)).slice(1), [
          board[0],
          board[1],
          z(H.board),
        ]);
      lines.push({
        id: `${room.code}/CONDUIT`,
        kind: 'electric',
        levelId: level.id,
        points,
        radiusMm: 12,
        flat,
        confidence: conf,
      });
      markers.push({
        id: `${room.code}/LIGHT`,
        kind: 'light',
        levelId: level.id,
        p: [c[0], c[1], z(H.ceiling - 60)],
        label: 'Light point',
        flat,
        confidence: conf,
      });
      if (board)
        markers.push({
          id: `${room.code}/SB`,
          kind: 'switchboard',
          levelId: level.id,
          p: [board[0], board[1], z(H.board)],
          label: `Switch board · ${room.name}`,
          flat,
          confidence: conf,
        });
    }
  }

  return { lines, markers };
}

/** The flat's front door: a door node linked to one of its rooms and to the lobby. */
function findEntrance(
  rooms: LabelledSpace[],
  doors: Map<string, NavNode[]>,
  lobby: LabelledSpace | null,
): XY | null {
  if (!lobby) return null;
  const lobbyDoors = new Set((doors.get(lobby.code) ?? []).map((d) => d.id));
  for (const r of rooms) {
    for (const d of doors.get(r.code) ?? []) {
      if (lobbyDoors.has(d.id)) return [d.p[0], d.p[1]];
    }
  }
  // no shared door in the graph: the room nearest the lobby, on its lobby-facing side
  const near = nearest(
    rooms.map((r) => ({ p: xy(r), r })),
    xy(lobby),
  );
  return near ? towards(near.p, xy(lobby), Math.max(0, d2(near.p, xy(lobby)) - 600)) : null;
}
