export type FabricationProfile = 'laser-svg' | 'assembly-pdf' | 'inspection-svg';
export const fabricationProfiles = {
  'laser-svg': { includeGuides: false, includeLabels: false },
  'assembly-pdf': { includeGuides: true, includeLabels: true },
  'inspection-svg': { includeGuides: true, includeLabels: true },
} as const;
