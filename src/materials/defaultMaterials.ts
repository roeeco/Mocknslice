import type { MaterialProfile } from '../domain/material';

export const DEFAULT_MATERIALS: readonly MaterialProfile[] = [
  {
    id: 'paper-160gsm',
    name: '160 gsm paper',
    category: 'paper',
    thicknessMm: 0.16,
    kerfMm: 0,
    clearanceMm: 0.1,
    grainDirection: 'none',
    defaultSheetWidthMm: 210,
    defaultSheetHeightMm: 297,
  },
  {
    id: 'card-300gsm',
    name: '300 gsm card',
    category: 'card',
    thicknessMm: 0.35,
    kerfMm: 0.1,
    clearanceMm: 0.1,
    grainDirection: 'none',
    scoreAllowanceMm: 0.2,
    defaultSheetWidthMm: 210,
    defaultSheetHeightMm: 297,
  },
  {
    id: 'chipboard-1mm',
    name: '1 mm chipboard',
    category: 'card',
    thicknessMm: 1,
    kerfMm: 0.15,
    clearanceMm: 0.15,
    grainDirection: 'none',
    scoreAllowanceMm: 0.4,
    defaultSheetWidthMm: 300,
    defaultSheetHeightMm: 450,
  },
  {
    id: 'corrugated-3mm',
    name: '3 mm corrugated cardboard',
    category: 'corrugated-cardboard',
    thicknessMm: 3,
    kerfMm: 0.2,
    clearanceMm: 0.25,
    fluteDirection: 'vertical',
    scoreAllowanceMm: 1.5,
    minimumFoldRadiusMm: 1.5,
    defaultSheetWidthMm: 600,
    defaultSheetHeightMm: 900,
  },
  {
    id: 'plywood-3mm',
    name: '3 mm plywood',
    category: 'sheet-wood',
    thicknessMm: 3,
    kerfMm: 0.18,
    clearanceMm: 0.15,
    grainDirection: 'horizontal',
    defaultSheetWidthMm: 300,
    defaultSheetHeightMm: 600,
  },
] as const;

export function getDefaultMaterial(id: string): MaterialProfile {
  const material = DEFAULT_MATERIALS.find((candidate) => candidate.id === id);
  if (!material) {
    throw new Error(`Unknown default material: ${id}`);
  }
  return structuredClone(material);
}
