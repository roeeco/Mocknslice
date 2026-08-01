import type { AppSliceCreator, ViewportSlice } from '../types';

export const createViewportSlice: AppSliceCreator<ViewportSlice> = (set) => ({
  viewportMode: 'three',
  cameraPreset: 'isometric',
  activeWorkflowStep: 'start',
  setViewportMode: (viewportMode) => set({ viewportMode }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  setActiveWorkflowStep: (activeWorkflowStep) => set({ activeWorkflowStep }),
});
