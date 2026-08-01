import type { AppSliceCreator, ValidationSlice } from '../types';

export const createValidationSlice: AppSliceCreator<ValidationSlice> = (set) => ({
  validationIssues: [
    {
      id: 'foundation-slicing-unavailable',
      severity: 'info',
      code: 'PHASE_1_FOUNDATION_ONLY',
      message: 'Slice generation is not available in the foundation phase.',
      affectedEntityIds: [],
      suggestedAction: 'Inspect the example cube and configure a material for now.',
    },
  ],
  setValidationIssues: (validationIssues) => set({ validationIssues }),
});
