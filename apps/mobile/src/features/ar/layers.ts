import { create } from 'zustand';
import { type ArLayers, DEFAULT_LAYERS } from './spatial/scene';

interface LayersState {
  layers: ArLayers;
  toggle: (key: keyof ArLayers) => void;
}

/** Which groups the camera view and the 2D map draw. One store, so both screens agree. */
export const useArLayers = create<LayersState>((set) => ({
  layers: DEFAULT_LAYERS,
  toggle: (key) => set((s) => ({ layers: { ...s.layers, [key]: !s.layers[key] } })),
}));
