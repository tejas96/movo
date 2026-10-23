import { type NativeSyntheticEvent, requireNativeComponent, type ViewProps } from 'react-native';

/** Camera tracking state, same words on both platforms. */
export type ArTrackingState = 'initializing' | 'normal' | 'limited' | 'notAvailable' | 'paused';

/** One camera frame. Matrices are 16 numbers, column-major, AR world frame (Y up, gravity aligned). */
export interface ArPoseEvent {
  /** camera -> world (the camera's transform in world space) */
  camera: number[];
  /** world -> eye, already rotated for the screen orientation; use with `projection` to project world points */
  view: number[];
  projection: number[];
  width: number;
  height: number;
  /** milliseconds on the platform clock */
  t: number;
  /** where the camera points, degrees clockwise from north on the ground plane; -1 when unknown */
  heading: number;
  tracking: string;
}

/** A landmark plate was detected or updated. `transform` is plate -> world. */
export interface ArImageEvent {
  plateId: string;
  transform: number[];
  tracked: boolean;
}

export interface ArTrackingEvent {
  state: ArTrackingState;
  reason?: string;
}

export interface ArErrorEvent {
  code: string;
  message: string;
}

/** Plate list passed to the native side, as JSON in `plates`. */
export interface ArPlateInput {
  id: string;
  physicalWidthM: number;
  imageBase64: string;
}

/**
 * Animated surface look, evaluated on the GPU every camera frame.
 * chevron = floor ribbon with arrows that run forward; band = liquid bands along a tube;
 * pulse = short bright packets along a line; solid = plain colour with a rim.
 */
export type ArPattern = 'chevron' | 'band' | 'pulse' | 'solid';

export interface ArMeshStyle {
  /** rgba 0..1 */
  color: [number, number, number, number];
  /** rgb 0..1, the bright colour of the moving part */
  glow: [number, number, number];
  pattern: ArPattern;
  /** repeat length along the mesh, metres */
  period: number;
  /** metres per second along the mesh; negative runs backwards */
  speed: number;
}

/**
 * A triangle mesh in building metres (Z up). `params` carries two numbers per vertex:
 * distance along the shape and a lateral coordinate, which the pattern shaders read.
 */
export interface ArMesh {
  id: string;
  style: ArMeshStyle;
  positions: number[];
  normals: number[];
  params: number[];
  indices: number[];
}

export type ArLabelKind = 'room' | 'dest' | 'marker';

/** A text pill that always faces the camera and keeps a readable size. */
export interface ArLabel {
  id: string;
  text: string;
  sub?: string;
  kind: ArLabelKind;
  /** building metres */
  p: [number, number, number];
}

/** Everything the native side draws for one group. Sent as JSON. */
export interface ArSceneJson {
  meshes: ArMesh[];
  labels: ArLabel[];
}

export interface MovoArViewProps extends ViewProps {
  /** JSON string of ArPlateInput[] */
  plates: string;
  active: boolean;
  /** How often `onPose` fires. The HUD needs 3 to 5; nothing in JS draws per frame any more. */
  poseHz?: number;
  /**
   * AR world (metres) <- building (metres), 16 numbers column-major. null hides every group.
   * Changes only when a plate gives a new fix.
   */
  anchor?: number[] | null;
  /** JSON ArSceneJson: the level's static content (rooms, pipes, wires). Changes per level or layer toggle. */
  scene?: string;
  /** JSON ArSceneJson: the route ribbon and destination. Changes per route. */
  route?: string;
  onPose?: (e: NativeSyntheticEvent<ArPoseEvent>) => void;
  onImage?: (e: NativeSyntheticEvent<ArImageEvent>) => void;
  onTrackingState?: (e: NativeSyntheticEvent<ArTrackingEvent>) => void;
  onError?: (e: NativeSyntheticEvent<ArErrorEvent>) => void;
}

/**
 * The native camera view. Renders the camera image and, once `anchor` is set, draws `scene` and `route`
 * on the GPU in step with the camera. JS only sends content when it changes.
 */
export const MovoArView = requireNativeComponent<MovoArViewProps>('MovoArView');
