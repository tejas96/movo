import type { ArPoseEvent } from '@movo/ar-native';
import { invertRigid, transformPoint } from './math';
import type { Mat4, Vec3 } from './types';

export interface ScreenPoint {
  x: number;
  y: number;
  /** metres in front of the camera; negative = behind */
  depth: number;
  visible: boolean;
}

/** Projects a building point (mm) onto the camera view using the last frame's view and projection. */
export function makeProjector(
  tBlcsFromAr: Mat4,
  frame: ArPoseEvent,
  screenW: number,
  screenH: number,
) {
  const arFromBlcs = invertRigid(tBlcsFromAr);
  const v = frame.view as Mat4;
  const p = frame.projection as Mat4;
  return (pt: Vec3): ScreenPoint => {
    const ar = transformPoint(arFromBlcs, [pt[0] / 1000, pt[1] / 1000, pt[2] / 1000]);
    // eye = view * ar
    const ex = v[0] * ar[0] + v[4] * ar[1] + v[8] * ar[2] + v[12];
    const ey = v[1] * ar[0] + v[5] * ar[1] + v[9] * ar[2] + v[13];
    const ez = v[2] * ar[0] + v[6] * ar[1] + v[10] * ar[2] + v[14];
    // clip = projection * eye
    const cx = p[0] * ex + p[4] * ey + p[8] * ez + p[12];
    const cy = p[1] * ex + p[5] * ey + p[9] * ez + p[13];
    const cw = p[3] * ex + p[7] * ey + p[11] * ez + p[15];
    const depth = -ez;
    if (cw <= 0.0001) return { x: 0, y: 0, depth, visible: false };
    const nx = cx / cw;
    const ny = cy / cw;
    const x = ((nx + 1) / 2) * screenW;
    const y = ((1 - ny) / 2) * screenH;
    return { x, y, depth, visible: depth > 0.1 && nx > -1.2 && nx < 1.2 && ny > -1.2 && ny < 1.2 };
  };
}
