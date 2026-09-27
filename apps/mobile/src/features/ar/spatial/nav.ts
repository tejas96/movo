import type { BuildingModel, NavEdge, NavNode } from './types';

export interface RouteStep {
  node: NavNode;
  costS: number;
}

export interface Route {
  nodes: NavNode[];
  totalS: number;
  totalMm: number;
}

/** Shortest walking route on the building graph (Dijkstra, small graph). */
export function route(model: BuildingModel, fromId: string, toId: string): Route | null {
  const nodes = new Map(model.building.nav.nodes.map((n) => [n.id, n]));
  const adj = new Map<string, Array<{ to: string; e: NavEdge }>>();
  for (const e of model.building.nav.edges) {
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push({ to: e.b, e });
    adj.get(e.b)!.push({ to: e.a, e });
  }
  const dist = new Map<string, number>();
  const prev = new Map<string, { id: string; e: NavEdge }>();
  const done = new Set<string>();
  dist.set(fromId, 0);
  for (;;) {
    let u: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) if (!done.has(id) && d < best) (best = d), (u = id);
    if (u === null || u === toId) break;
    done.add(u);
    for (const { to, e } of adj.get(u) ?? []) {
      const nd = best + e.costS;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, { id: u, e });
      }
    }
  }
  if (!dist.has(toId)) return null;
  const seq: NavNode[] = [];
  let mm = 0;
  let cur = toId;
  for (;;) {
    seq.push(nodes.get(cur)!);
    const p = prev.get(cur);
    if (!p) break;
    mm += p.e.lengthMm;
    cur = p.id;
  }
  seq.reverse();
  return { nodes: seq, totalS: dist.get(toId)!, totalMm: mm };
}

/** Nearest graph node on a level to a point (mm). */
export function nearestNode(model: BuildingModel, levelId: string, x: number, y: number, kinds?: string[]): NavNode | null {
  let best: NavNode | null = null;
  let bd = Infinity;
  for (const n of model.building.nav.nodes) {
    if (n.levelId !== levelId) continue;
    if (kinds && !kinds.includes(n.kind)) continue;
    const d = Math.hypot(n.p[0] - x, n.p[1] - y);
    if (d < bd) (bd = d), (best = n);
  }
  return best;
}

/** Destination choices: flats, common spaces, lift, entries. */
export function destinations(model: BuildingModel): NavNode[] {
  return model.building.nav.nodes.filter(
    (n) => (n.kind === 'space' && n.space && !/WALLS/.test(n.space)) || n.kind === 'lift' || n.kind === 'entrance' || n.kind === 'shop',
  );
}
