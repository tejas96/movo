import { useMemo } from 'react';
import { useLocalizer } from './spatial/localizer';
import { levelById, model } from './spatial/model';
import { nearestNode, route, type Route } from './spatial/nav';
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
  return useMemo(() => {
    if (!dest || !levelId) return null;
    const start = pose
      ? nearestNode(model, levelId, pose.x, pose.y, ['space', 'door', 'lift', 'stair', 'entrance'])
      : nearestNode(model, levelId, -600, 970, ['lift']);
    if (!start) return null;
    const r = route(model, start.id, dest.id);
    if (!r) return null;
    const points: Vec3[] = r.nodes.map((n) => {
      const lv = levelById(n.levelId);
      return [n.p[0], n.p[1], (lv?.elevationMm ?? 0) + 100];
    });
    return { route: r, points, next: r.nodes[1] ?? null };
  }, [dest, levelId, pose?.x, pose?.y]);
}
