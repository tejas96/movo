import { create } from 'zustand';
import type { ArImageEvent, ArPoseEvent } from '@movo/ar-native';
import { PLATES } from '../plates.generated';
import { AR_TO_UP_Z, invertRigid, mul, normalize, rotZ, transformDir, transformPoint, translation } from './math';
import type { DevicePose, Mat4, PlateDefinition, Vec3 } from './types';

/**
 * Localizer: turns ARKit/ARCore tracking plus plate detections into a device pose in the building frame.
 *
 * Fix (from a plate): gravity keeps pitch and roll; the plate gives yaw, position and the floor.
 * Between fixes the phone's own tracking carries the pose; confidence decays with distance and time.
 */

export interface LocalizerState {
  levelId: string | null;
  /** building (mm) <- AR world (m); null until the first plate fix */
  tBlcsFromAr: Mat4 | null;
  confidence: number;
  fixPlateId: string | null;
  fixAtMs: number;
  distanceSinceFixM: number;
  tracking: string;
  lastCamAr: Vec3 | null;
  pose: DevicePose | null;
  lastFrame: ArPoseEvent | null;
  onPose: (e: ArPoseEvent) => void;
  onImage: (e: ArImageEvent) => void;
  setTracking: (state: string) => void;
  reset: () => void;
}

const plateById = new Map<string, PlateDefinition>(PLATES.map((p) => [p.id, p]));
let lastPoseLog = 0;

/** BLCS <- plate frame (X = up x normal, Y = normal, Z = down), in metres. */
function plateInBlcsM(p: PlateDefinition): Mat4 | null {
  if (!p.position || !p.normal) return null;
  const n = normalize(p.normal);
  const x: Vec3 = normalize([-n[1], n[0], 0]);
  const z: Vec3 = [0, 0, -1];
  return [x[0], x[1], x[2], 0, n[0], n[1], n[2], 0, z[0], z[1], z[2], 0, p.position[0] / 1000, p.position[1] / 1000, p.position[2] / 1000, 1];
}

/** Gravity-constrained fix: yaw from the plate normal, position from the plate centre. Result maps AR metres to BLCS metres. */
export function computeFix(p: PlateDefinition, tArFromPlate: Mat4): Mat4 | null {
  const tBlcsFromPlate = plateInBlcsM(p);
  if (!tBlcsFromPlate) return null;
  const nAr = transformDir(tArFromPlate, [0, 1, 0]); // plate normal in AR world
  const nUp = transformDir(AR_TO_UP_Z, nAr); // same, in a Z-up frame
  const nB: Vec3 = [tBlcsFromPlate[4], tBlcsFromPlate[5], tBlcsFromPlate[6]];
  const yaw = Math.atan2(nB[1], nB[0]) - Math.atan2(nUp[1], nUp[0]);
  const R = mul(rotZ(yaw), AR_TO_UP_Z);
  const cAr = translation(tArFromPlate);
  const cR = transformPoint(R, cAr);
  const cB = translation(tBlcsFromPlate);
  const t: Vec3 = [cB[0] - cR[0], cB[1] - cR[1], cB[2] - cR[2]];
  return [R[0], R[1], R[2], 0, R[4], R[5], R[6], 0, R[8], R[9], R[10], 0, t[0], t[1], t[2], 1];
}

function yawDegFromCamera(tBlcsFromAr: Mat4, camera: Mat4): number {
  // camera looks down its -Z axis
  const fAr = transformDir(camera, [0, 0, -1]);
  const fB = transformDir(tBlcsFromAr, fAr);
  // 0 = +Y (north), clockwise positive
  const deg = (Math.atan2(fB[0], fB[1]) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export function decayConfidence(base: number, distanceM: number, ageS: number, tracking: string): number {
  let c = base - 0.02 * distanceM - 0.004 * ageS;
  if (tracking === 'limited') c -= 0.3;
  if (tracking === 'notAvailable') c = 0;
  return Math.max(0, Math.min(1, c));
}

export const useLocalizer = create<LocalizerState>((set, get) => ({
  levelId: null,
  tBlcsFromAr: null,
  confidence: 0,
  fixPlateId: null,
  fixAtMs: 0,
  distanceSinceFixM: 0,
  tracking: 'initializing',
  lastCamAr: null,
  pose: null,
  lastFrame: null,

  onPose: (e) => {
    const s = get();
    const cam = translation(e.camera as Mat4);
    let dist = s.distanceSinceFixM;
    if (s.lastCamAr) dist += Math.hypot(cam[0] - s.lastCamAr[0], cam[1] - s.lastCamAr[1], cam[2] - s.lastCamAr[2]);
    const tracking = e.tracking || s.tracking;
    if (!s.tBlcsFromAr) {
      set({ lastCamAr: cam, distanceSinceFixM: dist, tracking, lastFrame: e });
      return;
    }
    const pB = transformPoint(s.tBlcsFromAr, cam);
    const ageS = (Date.now() - s.fixAtMs) / 1000;
    const confidence = decayConfidence(0.9, dist, ageS, tracking);
    if (__DEV__ && Date.now() - lastPoseLog > 1000) {
      lastPoseLog = Date.now();
      console.log('[ar] pose', s.levelId, 'x', pB[0].toFixed(2), 'y', pB[1].toFixed(2), 'z', pB[2].toFixed(2), 'yaw', yawDegFromCamera(s.tBlcsFromAr, e.camera as Mat4).toFixed(0), 'conf', confidence.toFixed(2));
    }
    set({
      lastCamAr: cam,
      distanceSinceFixM: dist,
      tracking,
      lastFrame: e,
      confidence,
      pose: {
        levelId: s.levelId,
        x: pB[0] * 1000,
        y: pB[1] * 1000,
        z: pB[2] * 1000,
        yawDeg: yawDegFromCamera(s.tBlcsFromAr, e.camera as Mat4),
        confidence,
        fixSource: s.fixPlateId ? `plate:${s.fixPlateId}` : null,
        lastFixAgeS: ageS,
        distanceSinceFixM: dist,
      },
    });
  },

  onImage: (e) => {
    const plate = plateById.get(e.plateId);
    if (__DEV__) console.log('[ar] plate seen', e.plateId, e.tracked ? 'tracked' : 'lost', plate ? '' : '(unknown id)');
    if (!plate) return;
    const fix = computeFix(plate, e.transform as Mat4);
    if (!fix) return;
    // only take fixes while the image is actively tracked and reasonably close (within 3 m)
    const s = get();
    const cAr = translation(e.transform as Mat4);
    const cam = s.lastCamAr;
    const range = cam ? Math.hypot(cAr[0] - cam[0], cAr[1] - cam[1], cAr[2] - cam[2]) : 0;
    if (!e.tracked && s.tBlcsFromAr) return;
    if (range > 3.5) {
      if (__DEV__) console.log('[ar] plate too far', range.toFixed(2), 'm');
      return;
    }
    if (__DEV__) console.log('[ar] FIX from', plate.id, 'level', plate.levelId, 'range', range.toFixed(2), 'm');
    set({
      tBlcsFromAr: fix,
      levelId: plate.levelId,
      fixPlateId: plate.id,
      fixAtMs: Date.now(),
      distanceSinceFixM: 0,
      confidence: e.tracked ? 0.9 : 0.6,
    });
  },

  setTracking: (state) => set({ tracking: state }),
  reset: () =>
    set({ levelId: null, tBlcsFromAr: null, confidence: 0, fixPlateId: null, fixAtMs: 0, distanceSinceFixM: 0, lastCamAr: null, pose: null }),
}));

/** AR world (m) <- BLCS (mm): for placing model points in the camera frame. */
export function arFromBlcsMm(tBlcsFromAr: Mat4): (p: Vec3) => Vec3 {
  const inv = invertRigid(tBlcsFromAr);
  return (p) => transformPoint(inv, [p[0] / 1000, p[1] / 1000, p[2] / 1000]);
}
