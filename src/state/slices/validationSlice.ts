import { foundationValidationIssues } from '../../validation/projectValidation';
import type { AppSliceCreator, ValidationSlice } from '../types';

export const createValidationSlice: AppSliceCreator<ValidationSlice> = (set) => ({
  validationIssues: foundationValidationIssues(),
  setValidationIssues: (validationIssues) => set({ validationIssues }),
});
