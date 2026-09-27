/** Spatial model types for the AR guide. Mirrors docs/spatial/laxmi-pushp.building.json (schema 0.3). */

/** 16 numbers, column-major (same layout as ARKit simd and ARCore's toMatrix). */
export type Mat4 = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];
export type Vec3 = [number, number, number];

export interface LevelDef {
  id: string;
  index: number;
  name: string;
  elevationMm: number;
  heightMm: number | null;
  template: string | null;
}

export interface SpaceDef {
  id: string;
  code: string;
  kind: 'space';
  subtype: string;
  name: string;
  flatPosition: string | null;
  geometry: { type: 'polygon'; coords: number[][] };
  areaM2: number | null;
}

export interface ZoneDef {
  id: string;
  code: string;
  kind: 'zone';
  subtype: string;
  name: string;
  flatPosition: string | null;
  geometry: { type: 'polygon'; coords: number[][] } | null;
}

export interface ElementDef {
  id: string;
  code: string;
  kind: 'element';
  subtype: string;
  name: string;
  geometry: { type: 'polygon' | 'point'; coords: number[][] | number[] };
}

export interface TemplateDef {
  name: string;
  zones: ZoneDef[];
  spaces: SpaceDef[];
  elements: ElementDef[];
}

export interface NavNode {
  id: string;
  levelId: string;
  p: [number, number];
  kind: string;
  space: string | null;
  name: string | null;
}

export interface NavEdge {
  a: string;
  b: string;
  kind: string;
  lengthMm: number;
  costS: number;
}

export interface BuildingModel {
  schemaVersion: string;
  building: {
    code: string;
    name: string;
    frame: { units: string; originDescription: string };
    levels: LevelDef[];
    templates: Record<string, TemplateDef>;
    nav: { walkSpeedMps: number; nodes: NavNode[]; edges: NavEdge[] };
  };
}

/** A printed landmark plate. Pose is the plate centre in BLCS (mm); normal points out of the wall. */
export interface PlateDefinition {
  id: string;
  levelId: string;
  title: string;
  where: string;
  physicalWidthM: number;
  position: Vec3 | null;
  normal: Vec3 | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  status: 'PLANNED_NOT_MOUNTED' | 'MOUNTED' | 'POSE_TBD';
  imageBase64: string;
}

/** Where the phone is, in the building frame. */
export interface DevicePose {
  levelId: string | null;
  /** BLCS mm */
  x: number;
  y: number;
  z: number;
  /** degrees, 0 = facing +Y (plan north), clockwise positive */
  yawDeg: number;
  confidence: number; // 0..1
  fixSource: string | null;
  lastFixAgeS: number;
  distanceSinceFixM: number;
}
