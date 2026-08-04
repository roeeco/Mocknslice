import type { AppSliceCreator, SelectionSlice } from '../types';

export const createSelectionSlice: AppSliceCreator<SelectionSlice> = (set) => ({
  selectedPartId: undefined,
  selectedEntityId: undefined,
  selectEntity: (selectedEntityId, ownerPartId) =>
    set({ selectedEntityId, selectedPartId: ownerPartId ?? selectedEntityId }),
});
