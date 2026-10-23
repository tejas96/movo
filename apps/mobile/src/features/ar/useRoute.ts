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

const START_KINDS = ['space', 'door', 'lift', 'stair', 'entrance'];

/**
 * Route from where the phone is (or from the lift on `fallbackLevelId`) to a destination node.
 * The route object only changes when the nearest start node changes, so the camera scene is not
 * re-sent while the phone drifts inside one room.
 */
export function useRoute(dest: NavNode | null, fallbackLevelId: string | null): RouteView | null {
  const pose = useLocalizer((s) => s.pose);
  const levelId = pose?.levelId ?? fallbackLevelId;
  const startId = useMemo(() => {
    if (!dest || !levelId) return null;
    const start = pose
      ? nearestNode(model, levelId, pose.x, pose.y, START_KINDS)
      : nearestNode(model, levelId, -600, 970, ['lift']);
    return start?.id ?? null;
  }, [dest, levelId, pose]);
  return useMemo(() => {
    if (!dest || !startId) return null;
    const r = route(model, startId, dest.id);
    if (!r) return null;
    const points: Vec3[] = r.nodes.map((n) => {
      const lv = levelById(n.levelId);
      return [n.p[0], n.p[1], (lv?.elevationMm ?? 0) + 100];
    });
    return { route: r, points, next: r.nodes[1] ?? null };
  }, [dest, startId]);
}
