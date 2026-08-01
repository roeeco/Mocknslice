import type { AppSliceCreator, ViewportSlice } from '../types';

export const createViewportSlice: AppSliceCreator<ViewportSlice> = (set) => ({
  viewportMode: 'three',
  cameraPreset: 'isometric',
  cameraResetToken: 0,
  activeWorkflowStep: 'start',
  setViewportMode: (viewportMode) => set({ viewportMode }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  fitCamera: () => set((state) => ({ cameraResetToken: state.cameraResetToken + 1 })),
  setActiveWorkflowStep: (activeWorkflowStep) => set({ activeWorkflowStep }),
});
