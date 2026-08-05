const metadata = {
  id: 'project-legacy-fixture',
  name: 'Legacy fixture',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const model = {
  id: 'model-legacy-fixture',
  name: '40 mm cube',
  source: { kind: 'built-in', primitive: 'cube' },
  dimensions: { widthMm: 40, heightMm: 40, depthMm: 40 },
  transform: {
    positionMm: [0, 0, 0],
    rotationDeg: [0, 0, 0],
    scale: [1, 1, 1],
  },
};

const materialProfileSnapshot = {
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
};

const operationStyles = [
  { operation: 'cut', stroke: '#ff0000', strokeWidthMm: 0.1 },
  { operation: 'score', stroke: '#0000ff', strokeWidthMm: 0.1 },
  { operation: 'mountain-fold', stroke: '#8b5cf6', strokeWidthMm: 0.1 },
  { operation: 'valley-fold', stroke: '#14b8a6', strokeWidthMm: 0.1 },
  { operation: 'perforate', stroke: '#f59e0b', strokeWidthMm: 0.1 },
  { operation: 'engrave', stroke: '#000000', strokeWidthMm: 0.1 },
  { operation: 'guide', stroke: '#6b7280', strokeWidthMm: 0.1 },
];

const legacyExportSettings = {
  includeLabels: true,
  includeRegistrationMarks: false,
  includeSheetBoundary: true,
  operationStyles,
};

const currentExportSettings = {
  ...legacyExportSettings,
  kerfCompensation: 'none',
  customKerfMm: 0.1,
  foldLineOutput: 'preserve',
  perforationDashMm: 2,
  perforationGapMm: 1,
  labelFontSizeMm: 3,
};

const stacked = {
  sliceAxis: 'z',
  spacingMm: 10,
  sliceThicknessMm: 0.35,
  contourEpsilonMm: 0.001,
};

const waffle = {
  wafflePrimaryAxis: 'x',
  waffleSecondaryAxis: 'y',
  wafflePrimarySpacingMm: 20,
  waffleSecondarySpacingMm: 20,
  waffleThicknessMm: 0.35,
  waffleClearanceMm: 0.1,
  waffleSlotPattern: 'alternating',
  waffleReverseSlots: false,
};

const folding = {
  foldTemplateKind: 'open-box',
  foldFitAxis: 'z',
  foldClearanceMm: 0.1,
  foldProfileToleranceMm: 1,
  foldWallHeightMm: 40,
  foldTabDepthMm: 8,
  foldLidDepthMm: 15,
  foldLidClearanceMm: 0.5,
  foldGussetDepthMm: 40,
  foldClosureFlapMm: 12,
  foldPrismSides: 6,
  foldPrismRotationDeg: 0,
  foldTopScale: 0,
  foldSeamTabMm: 8,
};

const unfolding = {
  meshUnfoldStrategy: 'automatic',
  meshUnfoldRootFace: 0,
  meshUnfoldSeams: '',
  meshUnfoldTabDepthMm: 6,
  meshUnfoldMaximumFaces: 200,
  meshUnfoldSearchAttempts: 18,
};

const panelConstruction = {
  panelInnerWidthMm: 80,
  panelInnerDepthMm: 60,
  panelInnerHeightMm: 50,
  panelJointKind: 'finger',
  panelFingerWidthMm: 10,
  panelClearanceMm: 0.1,
  panelIncludeLid: false,
};

function project(modeParameters: Record<string, string | number | boolean>, modernOutput: boolean) {
  return {
    metadata,
    model,
    fabricationMode: 'stacked-slices',
    materialProfileSnapshot,
    modeParameters,
    generatedParts: [],
    generationIssues: [],
    sheetLayouts: [
      {
        id: 'sheet-legacy-fixture',
        widthMm: 210,
        heightMm: 297,
        marginMm: 5,
        spacingMm: 3,
        placements: [],
      },
    ],
    exportSettings: modernOutput ? currentExportSettings : legacyExportSettings,
    acknowledgedWarningIds: [],
  };
}

export const legacyProjectFixtures = [
  {
    version: 1,
    source: JSON.stringify({
      format: 'slicefold-project',
      version: 1,
      project: project(stacked, false),
    }),
  },
  {
    version: 2,
    source: JSON.stringify({
      format: 'slicefold-project',
      version: 2,
      project: project({ ...stacked, ...waffle, ...folding }, false),
    }),
  },
  {
    version: 3,
    source: JSON.stringify({
      format: 'slicefold-project',
      version: 3,
      project: project({ ...stacked, ...waffle, ...folding }, true),
    }),
  },
  {
    version: 4,
    source: JSON.stringify({
      format: 'slicefold-project',
      version: 4,
      project: project({ ...stacked, ...waffle, ...folding, ...unfolding }, true),
    }),
  },
  {
    version: 5,
    source: JSON.stringify({
      format: 'slicefold-project',
      version: 5,
      project: project(
        {
          ...stacked,
          ...waffle,
          ...folding,
          ...unfolding,
          ...panelConstruction,
        },
        true,
      ),
    }),
  },
  {
    version: 6,
    source: JSON.stringify({
      format: 'mocknslice-project',
      version: 6,
      project: project(
        {
          ...stacked,
          ...waffle,
          ...folding,
          ...unfolding,
          ...panelConstruction,
          workflowSourceMode: 'import',
          foldSizeMode: 'auto-fit',
          foldClosureMethod: 'glue',
          foldSlotClearanceMm: 0.1,
          panelWidthDividerCount: 0,
          panelDepthDividerCount: 0,
          panelDividerCount: 0,
          panelDividerAxis: 'width',
        },
        true,
      ),
    }),
  },
] as const;
