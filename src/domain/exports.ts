import type { OperationStyle } from './operations';

export type KerfCompensationMode = 'none' | 'material' | 'custom';
export type FoldLineOutput = 'preserve' | 'score' | 'perforate';

export interface ExportSettings {
  includeLabels: boolean;
  includeRegistrationMarks: boolean;
  includeSheetBoundary: boolean;
  kerfCompensation: KerfCompensationMode;
  customKerfMm: number;
  foldLineOutput: FoldLineOutput;
  perforationDashMm: number;
  perforationGapMm: number;
  labelFontSizeMm: number;
  operationStyles: OperationStyle[];
}
