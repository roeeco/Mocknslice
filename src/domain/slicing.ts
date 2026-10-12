import type { Point2D } from './geometry';
import type { SliceAxis } from './fabrication';

export interface StackedSliceSettings {
  firstLayerOffsetMm?: number | undefined;
  registrationHoles?: { id: string; centres: [Point2D, Point2D]; diameterMm: number } | undefined;
  axis: SliceAxis;
  spacingMm: number;
  thicknessMm: number;
  contourEpsilonMm: number;
}

export type WaffleSlotPattern = 'by-family' | 'alternating';

export interface WaffleSliceSettings {
  primaryAxis: SliceAxis;
  secondaryAxis: SliceAxis;
  primarySpacingMm: number;
  secondarySpacingMm: number;
  thicknessMm: number;
  clearanceMm: number;
  contourEpsilonMm: number;
  slotPattern: WaffleSlotPattern;
  reverseSlots: boolean;
}
