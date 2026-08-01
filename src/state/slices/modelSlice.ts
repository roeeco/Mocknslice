import type { AppSliceCreator, ModelSlice } from '../types';

export const createModelSlice: AppSliceCreator<ModelSlice> = (set) => ({
  modelHealthReport: {
    triangleCount: 12,
    openEdgeCount: 0,
    nonManifoldEdgeCount: 0,
    disconnectedShellCount: 1,
    orientationIssueCount: 0,
    inspected: true,
  },
  setModelHealthReport: (modelHealthReport) => set({ modelHealthReport }),
});
