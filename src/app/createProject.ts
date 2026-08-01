import type { ProjectData } from '../domain/project';
import { createCubeMesh } from '../geometry/mesh/createPrimitiveMesh';
import { getDefaultMaterial } from '../materials/defaultMaterials';

const CUBE_SIZE_MM = 40;

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createProject(name = 'Untitled project'): ProjectData {
  const now = new Date().toISOString();
  const material = getDefaultMaterial('card-300gsm');
  const primitive = createCubeMesh(CUBE_SIZE_MM);

  return {
    metadata: {
      id: createId('project'),
      name,
      createdAt: now,
      updatedAt: now,
    },
    model: {
      id: createId('model'),
      name: '40 mm cube',
      source: { kind: 'built-in', primitive: 'cube' },
      dimensions: {
        widthMm: CUBE_SIZE_MM,
        heightMm: CUBE_SIZE_MM,
        depthMm: CUBE_SIZE_MM,
      },
      transform: {
        positionMm: [0, 0, 0],
        rotationDeg: [0, 0, 0],
        scale: [1, 1, 1],
      },
      mesh: primitive.mesh,
      bounds: primitive.bounds,
      healthReport: primitive.healthReport,
    },
    fabricationMode: 'stacked-slices',
    materialProfileSnapshot: material,
    modeParameters: {
      sliceAxis: 'z',
      spacingMm: 10,
      sliceThicknessMm: material.thicknessMm,
      contourEpsilonMm: 0.001,
      wafflePrimaryAxis: 'x',
      waffleSecondaryAxis: 'y',
      wafflePrimarySpacingMm: 20,
      waffleSecondarySpacingMm: 20,
      waffleThicknessMm: material.thicknessMm,
      waffleClearanceMm: material.clearanceMm,
      waffleSlotPattern: 'alternating',
      waffleReverseSlots: false,
      foldTemplateKind: 'open-box',
      workflowSourceMode: 'import',
      foldFitAxis: 'z',
      foldClearanceMm: material.clearanceMm,
      foldProfileToleranceMm: 1,
      foldSizeMode: 'auto-fit',
      foldWallHeightMm: CUBE_SIZE_MM,
      foldTabDepthMm: 8,
      foldLidDepthMm: 15,
      foldLidClearanceMm: 0.5,
      foldGussetDepthMm: CUBE_SIZE_MM,
      foldClosureFlapMm: 12,
      foldPrismSides: 6,
      foldPrismRotationDeg: 0,
      foldTopScale: 0,
      foldSeamTabMm: 8,
      foldClosureMethod: 'glue',
      foldSlotClearanceMm: material.clearanceMm,
      meshUnfoldStrategy: 'automatic',
      meshUnfoldRootFace: 0,
      meshUnfoldSeams: '',
      meshUnfoldTabDepthMm: 6,
      meshUnfoldMaximumFaces: 200,
      meshUnfoldSearchAttempts: 18,
      panelInnerWidthMm: 80,
      panelInnerDepthMm: 60,
      panelInnerHeightMm: 50,
      panelJointKind: 'finger',
      panelFingerWidthMm: 10,
      panelClearanceMm: material.clearanceMm,
      panelIncludeLid: false,
      panelDividerCount: 0,
      panelDividerAxis: 'width',
    },
    generatedParts: [],
    generationIssues: [],
    sheetLayouts: [
      {
        id: createId('sheet'),
        widthMm: material.defaultSheetWidthMm,
        heightMm: material.defaultSheetHeightMm,
        marginMm: 5,
        spacingMm: 3,
        placements: [],
      },
    ],
    exportSettings: {
      includeLabels: true,
      includeRegistrationMarks: false,
      includeSheetBoundary: true,
      kerfCompensation: 'none',
      customKerfMm: material.kerfMm,
      foldLineOutput: 'preserve',
      perforationDashMm: 2,
      perforationGapMm: 1,
      labelFontSizeMm: 3,
      operationStyles: [
        { operation: 'cut', stroke: '#ff0000', strokeWidthMm: 0.1 },
        { operation: 'score', stroke: '#0000ff', strokeWidthMm: 0.1 },
        { operation: 'mountain-fold', stroke: '#8b5cf6', strokeWidthMm: 0.1 },
        { operation: 'valley-fold', stroke: '#14b8a6', strokeWidthMm: 0.1 },
        { operation: 'perforate', stroke: '#f59e0b', strokeWidthMm: 0.1 },
        { operation: 'engrave', stroke: '#000000', strokeWidthMm: 0.1 },
        { operation: 'guide', stroke: '#6b7280', strokeWidthMm: 0.1 },
      ],
    },
    acknowledgedWarningIds: [],
  };
}

export function prepareProjectForUse(project: ProjectData): ProjectData {
  const primitive =
    project.model.source.kind === 'built-in' && (!project.model.mesh || !project.model.bounds)
      ? createCubeMesh(project.model.dimensions.widthMm)
      : undefined;
  return {
    ...project,
    model: primitive
      ? {
          ...project.model,
          mesh: primitive.mesh,
          bounds: primitive.bounds,
          healthReport: primitive.healthReport,
        }
      : project.model,
    modeParameters: {
      sliceAxis: 'z',
      spacingMm: 10,
      sliceThicknessMm: project.materialProfileSnapshot.thicknessMm,
      contourEpsilonMm: 0.001,
      wafflePrimaryAxis: 'x',
      waffleSecondaryAxis: 'y',
      wafflePrimarySpacingMm: 20,
      waffleSecondarySpacingMm: 20,
      waffleThicknessMm: project.materialProfileSnapshot.thicknessMm,
      waffleClearanceMm: project.materialProfileSnapshot.clearanceMm,
      waffleSlotPattern: 'alternating',
      waffleReverseSlots: false,
      foldTemplateKind: 'open-box',
      workflowSourceMode: 'import',
      foldFitAxis: 'z',
      foldClearanceMm: project.materialProfileSnapshot.clearanceMm,
      foldProfileToleranceMm: 1,
      foldSizeMode: 'auto-fit',
      foldWallHeightMm: project.model.dimensions.depthMm,
      foldTabDepthMm: 8,
      foldLidDepthMm: 15,
      foldLidClearanceMm: 0.5,
      foldGussetDepthMm: project.model.dimensions.depthMm,
      foldClosureFlapMm: 12,
      foldPrismSides: 6,
      foldPrismRotationDeg: 0,
      foldTopScale: 0,
      foldSeamTabMm: 8,
      foldClosureMethod: 'glue',
      foldSlotClearanceMm: project.materialProfileSnapshot.clearanceMm,
      meshUnfoldStrategy: 'automatic',
      meshUnfoldRootFace: 0,
      meshUnfoldSeams: '',
      meshUnfoldTabDepthMm: 6,
      meshUnfoldMaximumFaces: 200,
      meshUnfoldSearchAttempts: 18,
      panelInnerWidthMm: 80,
      panelInnerDepthMm: 60,
      panelInnerHeightMm: 50,
      panelJointKind: 'finger',
      panelFingerWidthMm: 10,
      panelClearanceMm: project.materialProfileSnapshot.clearanceMm,
      panelIncludeLid: false,
      panelDividerCount: 0,
      panelDividerAxis: 'width',
      ...project.modeParameters,
    },
    generationIssues: project.generationIssues ?? [],
    exportSettings: {
      ...project.exportSettings,
      kerfCompensation: project.exportSettings.kerfCompensation ?? 'none',
      customKerfMm: project.exportSettings.customKerfMm ?? project.materialProfileSnapshot.kerfMm,
      foldLineOutput: project.exportSettings.foldLineOutput ?? 'preserve',
      perforationDashMm: project.exportSettings.perforationDashMm ?? 2,
      perforationGapMm: project.exportSettings.perforationGapMm ?? 1,
      labelFontSizeMm: project.exportSettings.labelFontSizeMm ?? 3,
    },
  };
}
