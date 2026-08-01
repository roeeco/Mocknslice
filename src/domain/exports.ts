import type { OperationStyle } from './operations';

export interface ExportSettings {
  includeLabels: boolean;
  includeRegistrationMarks: boolean;
  includeSheetBoundary: boolean;
  operationStyles: OperationStyle[];
}
