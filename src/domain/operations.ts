export type OperationType =
  'cut' | 'score' | 'mountain-fold' | 'valley-fold' | 'perforate' | 'engrave' | 'guide';

export interface OperationStyle {
  operation: OperationType;
  stroke: string;
  strokeWidthMm: number;
}
