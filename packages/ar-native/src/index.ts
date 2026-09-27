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

export interface MovoArViewProps extends ViewProps {
  /** JSON string of ArPlateInput[] */
  plates: string;
  active: boolean;
  poseHz?: number;
  onPose?: (e: NativeSyntheticEvent<ArPoseEvent>) => void;
  onImage?: (e: NativeSyntheticEvent<ArImageEvent>) => void;
  onTrackingState?: (e: NativeSyntheticEvent<ArTrackingEvent>) => void;
  onError?: (e: NativeSyntheticEvent<ArErrorEvent>) => void;
}

/** The native camera view. Renders the camera image only; JS draws labels and routes on top. */
export const MovoArView = requireNativeComponent<MovoArViewProps>('MovoArView');
