import type { AppSliceCreator, ViewportSlice } from '../types';

export const createViewportSlice: AppSliceCreator<ViewportSlice> = (set) => ({
  viewportMode: 'three',
  cameraPreset: 'isometric',
  cameraResetToken: 0,
  activeWorkflowStep: 'start',
  foldPreviewProgress: 0,
  setViewportMode: (viewportMode) => set({ viewportMode }),
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  fitCamera: () => set((state) => ({ cameraResetToken: state.cameraResetToken + 1 })),
  setActiveWorkflowStep: (activeWorkflowStep) => set({ activeWorkflowStep }),
  setFoldPreviewProgress: (progress) =>
    set({
      foldPreviewProgress: Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)),
    }),
});
