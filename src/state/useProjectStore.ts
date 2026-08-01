import { create } from 'zustand';
import { createExportSlice } from './slices/exportSlice';
import { createFabricationSlice } from './slices/fabricationSlice';
import { createHistorySlice } from './slices/historySlice';
import { createMaterialLibrarySlice } from './slices/materialLibrarySlice';
import { createModelSlice } from './slices/modelSlice';
import { createProjectSlice } from './slices/projectSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createValidationSlice } from './slices/validationSlice';
import { createViewportSlice } from './slices/viewportSlice';
import type { AppState } from './types';

export const useProjectStore = create<AppState>()((...args) => ({
  ...createProjectSlice(...args),
  ...createModelSlice(...args),
  ...createFabricationSlice(...args),
  ...createViewportSlice(...args),
  ...createSelectionSlice(...args),
  ...createMaterialLibrarySlice(...args),
  ...createHistorySlice(...args),
  ...createExportSlice(...args),
  ...createValidationSlice(...args),
}));
