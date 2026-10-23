import type { ArImageEvent, ArPoseEvent } from '@movo/ar-native';
import { create } from 'zustand';
import { arLog } from '../debug';
import { PLATES } from '../plates.generated';
import {
  AR_TO_UP_Z,
  invertRigid,
  mul,
  normalize,
  rotZ,
  transformDir,
  transformPoint,
  translation,
} from './math';
import { levelById } from './model';
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
  /** confidence right after the fix: 0.9 from a plate, less from a manual pick */
  fixBase: number;
  fixAtMs: number;
  distanceSinceFixM: number;
  tracking: string;
  lastCamAr: Vec3 | null;
  pose: DevicePose | null;
  onPose: (e: ArPoseEvent) => void;
  onImage: (e: ArImageEvent) => void;
  /** The user says where they are: a level and a point (mm). The compass gives the facing direction. */
  manualFix: (levelId: string, x: number, y: number) => void;
  setTracking: (state: string) => void;
  reset: () => void;
}

const plateById = new Map<string, PlateDefinition>(PLATES.map((p) => [p.id, p]));
let lastPoseLog = 0;

/** Re-fix from the same plate only after this much time or walking, so the scene does not twitch. */
const FIX_REFRESH_S = 20;
const FIX_REFRESH_M = 6;

/** Per-frame values that no screen reads. Kept out of the store so a pose event never re-renders anything. */
const scratch: {
  lastCamAr: Vec3 | null;
  lastCamera: Mat4 | null;
  headingDeg: number;
  distanceSinceFixM: number;
  /** a manual pick made before the camera delivered a frame; applied on the first frame */
  pendingManual: { levelId: string; x: number; y: number } | null;
} = {
  lastCamAr: null,
  lastCamera: null,
  headingDeg: -1,
  distanceSinceFixM: 0,
  pendingManual: null,
};

/** Phone height above the floor when someone holds it up to look through the camera. */
const HAND_HEIGHT_M = 1.4;

/**
 * Fix without a plate: the camera is at `target` (building metres) and points along the compass heading
 * (degrees clockwise from north; < 0 = unknown, keep the AR yaw). Result maps AR metres to BLCS metres.
 */
export function computeManualFix(camera: Mat4, headingDeg: number, target: Vec3): Mat4 {
  const fAr = transformDir(camera, [0, 0, -1]);
  const fUp = transformDir(AR_TO_UP_Z, fAr);
  const yawAr = Math.atan2(fUp[1], fUp[0]);
  const h = (headingDeg * Math.PI) / 180;
  const yawB = headingDeg >= 0 ? Math.atan2(Math.cos(h), Math.sin(h)) : yawAr;
  const R = mul(rotZ(yawB - yawAr), AR_TO_UP_Z);
  const cR = transformPoint(R, translation(camera));
  const t: Vec3 = [target[0] - cR[0], target[1] - cR[1], target[2] - cR[2]];
  return [R[0], R[1], R[2], 0, R[4], R[5], R[6], 0, R[8], R[9], R[10], 0, t[0], t[1], t[2], 1];
}

function samePose(a: DevicePose, b: DevicePose): boolean {
  return (
    a.levelId === b.levelId &&
    Math.abs(a.x - b.x) < 100 &&
    Math.abs(a.y - b.y) < 100 &&
    Math.abs(a.yawDeg - b.yawDeg) < 3 &&
    Math.abs(a.confidence - b.confidence) < 0.01
  );
}

/** BLCS <- plate frame (X = up x normal, Y = normal, Z = down), in metres. */
function plateInBlcsM(p: PlateDefinition): Mat4 | null {
  if (!p.position || !p.normal) return null;
  const n = normalize(p.normal);
  const x: Vec3 = normalize([-n[1], n[0], 0]);
  const z: Vec3 = [0, 0, -1];
  return [
    x[0],
    x[1],
    x[2],
    0,
    n[0],
    n[1],
    n[2],
    0,
    z[0],
    z[1],
    z[2],
    0,
    p.position[0] / 1000,
    p.position[1] / 1000,
    p.position[2] / 1000,
    1,
  ];
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

export function decayConfidence(
  base: number,
  distanceM: number,
  ageS: number,
  tracking: string,
): number {
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
  fixBase: 0.9,
  fixAtMs: 0,
  distanceSinceFixM: 0,
  tracking: 'initializing',
  lastCamAr: null,
  pose: null,

  onPose: (e) => {
    const s = get();
    const cam = translation(e.camera as Mat4);
    let dist = s.distanceSinceFixM;
    if (s.lastCamAr)
      dist += Math.hypot(cam[0] - s.lastCamAr[0], cam[1] - s.lastCamAr[1], cam[2] - s.lastCamAr[2]);
    const tracking = e.tracking || s.tracking;
    scratch.lastCamera = e.camera as Mat4;
    if (typeof e.heading === 'number' && e.heading >= 0) scratch.headingDeg = e.heading;
    if (!s.tBlcsFromAr) {
      // keep the camera trail without waking any screen: nothing drawn depends on it
      scratch.lastCamAr = cam;
      scratch.distanceSinceFixM = dist;
      if (tracking !== s.tracking) set({ tracking });
      const pm = scratch.pendingManual;
      if (pm && tracking === 'normal') {
        scratch.pendingManual = null;
        get().manualFix(pm.levelId, pm.x, pm.y);
      }
      return;
    }
    const pB = transformPoint(s.tBlcsFromAr, cam);
    const ageS = (Date.now() - s.fixAtMs) / 1000;
    const confidence = decayConfidence(s.fixBase, dist, ageS, tracking);
    const yawDeg = yawDegFromCamera(s.tBlcsFromAr, e.camera as Mat4);
    if (Date.now() - lastPoseLog > 1000) {
      lastPoseLog = Date.now();
      arLog(
        'pose',
        s.levelId,
        'x',
        pB[0].toFixed(2),
        'y',
        pB[1].toFixed(2),
        'yaw',
        yawDeg.toFixed(0),
        'conf',
        confidence.toFixed(2),
      );
    }
    const pose: DevicePose = {
      levelId: s.levelId,
      x: pB[0] * 1000,
      y: pB[1] * 1000,
      z: pB[2] * 1000,
      yawDeg,
      confidence,
      fixSource: s.fixPlateId ? `plate:${s.fixPlateId}` : 'manual',
      lastFixAgeS: ageS,
      distanceSinceFixM: dist,
    };
    scratch.lastCamAr = cam;
    scratch.distanceSinceFixM = dist;
    // Screens re-render only when the pose moved enough to show: 10 cm, 3 degrees or 1 % confidence.
    if (s.pose && samePose(s.pose, pose) && tracking === s.tracking) return;
    set({ lastCamAr: cam, distanceSinceFixM: dist, tracking, confidence, pose });
  },

  onImage: (e) => {
    const plate = plateById.get(e.plateId);
    arLog('plate seen', e.plateId, e.tracked ? 'tracked' : 'lost', plate ? '' : '(unknown id)');
    if (!plate) return;
    const s = get();
    const cam = scratch.lastCamAr ?? s.lastCamAr;
    const cAr = translation(e.transform as Mat4);
    const range = cam ? Math.hypot(cAr[0] - cam[0], cAr[1] - cam[1], cAr[2] - cam[2]) : 0;
    if (!e.tracked && s.tBlcsFromAr) return;
    if (range > 3.5) {
      arLog('plate too far', range.toFixed(2), 'm');
      return;
    }
    // A fix moves every drawn object. Take it when there is none, when it is a different plate,
    // or when the current one has gone stale; otherwise keep the world steady.
    const ageS = (Date.now() - s.fixAtMs) / 1000;
    const stale = ageS > FIX_REFRESH_S || scratch.distanceSinceFixM > FIX_REFRESH_M;
    if (s.tBlcsFromAr && s.fixPlateId === plate.id && !stale) return;
    const fix = computeFix(plate, e.transform as Mat4);
    if (!fix) return;
    arLog('FIX from', plate.id, 'level', plate.levelId, 'range', range.toFixed(2), 'm');
    scratch.distanceSinceFixM = 0;
    set({
      tBlcsFromAr: fix,
      levelId: plate.levelId,
      fixPlateId: plate.id,
      fixBase: 0.9,
      fixAtMs: Date.now(),
      distanceSinceFixM: 0,
      confidence: e.tracked ? 0.9 : 0.6,
    });
  },

  manualFix: (levelId, x, y) => {
    const level = levelById(levelId);
    if (!level) return;
    const cam = scratch.lastCamera;
    if (!cam) {
      // no camera frame yet: remember the pick, show the level now, fix on the first frame
      scratch.pendingManual = { levelId, x, y };
      set({ levelId });
      return;
    }
    const heading = scratch.headingDeg;
    const base = heading >= 0 ? 0.55 : 0.35;
    const fix = computeManualFix(cam, heading, [
      x / 1000,
      y / 1000,
      level.elevationMm / 1000 + HAND_HEIGHT_M,
    ]);
    arLog('MANUAL fix', levelId, x, y, 'heading', heading.toFixed(0));
    const camAr = translation(cam);
    const check = transformPoint(fix, camAr);
    const back = transformPoint(invertRigid(fix), [
      x / 1000,
      y / 1000,
      level.elevationMm / 1000 + 1.2,
    ]);
    scratch.distanceSinceFixM = 0;
    set({
      tBlcsFromAr: fix,
      levelId,
      fixPlateId: null,
      fixBase: base,
      fixAtMs: Date.now(),
      distanceSinceFixM: 0,
      confidence: base,
      pose: {
        levelId,
        x,
        y,
        z: level.elevationMm + HAND_HEIGHT_M * 1000,
        yawDeg: heading >= 0 ? heading : 0,
        confidence: base,
        fixSource: 'manual',
        lastFixAgeS: 0,
        distanceSinceFixM: 0,
      },
    });
  },

  setTracking: (state) => set({ tracking: state }),
  reset: () => {
    scratch.lastCamAr = null;
    scratch.lastCamera = null;
    scratch.headingDeg = -1;
    scratch.distanceSinceFixM = 0;
    scratch.pendingManual = null;
    set({
      levelId: null,
      tBlcsFromAr: null,
      confidence: 0,
      fixPlateId: null,
      fixBase: 0.9,
      fixAtMs: 0,
      distanceSinceFixM: 0,
      lastCamAr: null,
      pose: null,
    });
  },
}));

/** AR world (m) <- BLCS (mm): for placing model points in the camera frame. */
export function arFromBlcsMm(tBlcsFromAr: Mat4): (p: Vec3) => Vec3 {
  const inv = invertRigid(tBlcsFromAr);
  return (p) => transformPoint(inv, [p[0] / 1000, p[1] / 1000, p[2] / 1000]);
}
