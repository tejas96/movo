import { useMemo } from 'react';
import { useLocalizer } from './spatial/localizer';
import { levelById, model } from './spatial/model';
import { nearestNode, type Route, route } from './spatial/nav';
import type { NavNode, Vec3 } from './spatial/types';

export interface RouteView {
  route: Route;
  /** polyline points in BLCS mm, 100 mm above each node's floor */
  points: Vec3[];
  next: NavNode | null;
}

/** Route from where the phone is (or from the lift on `fallbackLevelId`) to a destination node. */
export function useRoute(dest: NavNode | null, fallbackLevelId: string | null): RouteView | null {
  const pose = useLocalizer((s) => s.pose);
  const levelId = pose?.levelId ?? fallbackLevelId;
  // round to 0.25 m so the route is not recomputed on every camera frame
  const px = pose ? Math.round(pose.x / 250) * 250 : null;
  const py = pose ? Math.round(pose.y / 250) * 250 : null;
  return useMemo(() => {
    if (!dest || !levelId) return null;
    const start =
      px !== null && py !== null
        ? nearestNode(model, levelId, px, py, ['space', 'door', 'lift', 'stair', 'entrance'])
        : nearestNode(model, levelId, -600, 970, ['lift']);
    if (!start) return null;
    const r = route(model, start.id, dest.id);
    if (!r) return null;
    const points: Vec3[] = r.nodes.map((n) => {
      const lv = levelById(n.levelId);
      return [n.p[0], n.p[1], (lv?.elevationMm ?? 0) + 100];
    });
    return { route: r, points, next: r.nodes[1] ?? null };
  }, [dest, levelId, px, py]);
}
