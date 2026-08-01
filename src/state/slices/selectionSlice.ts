import type { AppSliceCreator, SelectionSlice } from '../types';

export const createSelectionSlice: AppSliceCreator<SelectionSlice> = (set) => ({
  selectedEntityId: undefined,
  selectEntity: (selectedEntityId) => set({ selectedEntityId }),
});
