import type { DevicePose, NavNode } from './spatial/types';
import type { RouteView } from './useRoute';

export type Turn = 'straight' | 'left' | 'right' | 'back';

/** What the guide tells the user to do next. */
export interface StepInfo {
  next: NavNode;
  /** metres from the phone (or from the route start when there is no pose) */
  distM: number;
  /** relative to where the phone faces; null without a pose */
  turn: Turn | null;
  after: NavNode | null;
  remainingS: number;
  remainingM: number;
}

/** Bearing from `from` to `to`, degrees, 0 = plan north, clockwise. */
export function bearingDeg(from: [number, number], to: [number, number]): number {
  const deg = (Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function turnFor(relDeg: number): Turn {
  const rel = ((relDeg + 540) % 360) - 180;
  if (Math.abs(rel) < 35) return 'straight';
  if (Math.abs(rel) > 135) return 'back';
  return rel > 0 ? 'right' : 'left';
}

export function stepInfo(pose: DevicePose | null, routeView: RouteView | null): StepInfo | null {
  const next = routeView?.next;
  const first = routeView?.route.nodes[0];
  if (!routeView || !next || !first) return null;
  const from: [number, number] = pose ? [pose.x, pose.y] : first.p;
  const distM = Math.hypot(next.p[0] - from[0], next.p[1] - from[1]) / 1000;
  const turn = pose ? turnFor(bearingDeg(from, next.p) - pose.yawDeg) : null;
  return {
    next,
    distM,
    turn,
    after: routeView.route.nodes[2] ?? null,
    remainingS: routeView.route.totalS,
    remainingM: routeView.route.totalMm / 1000,
  };
}
