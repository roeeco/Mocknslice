import type { Millimetres } from './geometry';

export type MaterialCategory =
  'paper' | 'card' | 'corrugated-cardboard' | 'sheet-wood' | 'plastic' | 'custom';

export type MaterialDirection = 'none' | 'horizontal' | 'vertical';

export interface MaterialProfile {
  rotationAllowed?: boolean;
  id: string;
  name: string;
  category: MaterialCategory;
  thicknessMm: Millimetres;
  kerfMm: Millimetres;
  clearanceMm: Millimetres;
  grainDirection?: MaterialDirection;
  fluteDirection?: MaterialDirection;
  scoreAllowanceMm?: Millimetres;
  minimumFoldRadiusMm?: Millimetres;
  defaultSheetWidthMm: Millimetres;
  defaultSheetHeightMm: Millimetres;
}
