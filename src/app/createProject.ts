import type { ProjectData } from '../domain/project';
import { getDefaultMaterial } from '../materials/defaultMaterials';

const CUBE_SIZE_MM = 40;

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function createProject(name = 'Untitled project'): ProjectData {
  const now = new Date().toISOString();
  const material = getDefaultMaterial('card-300gsm');

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
    },
    fabricationMode: 'stacked-slices',
    materialProfileSnapshot: material,
    modeParameters: {
      sliceAxis: 'z',
      spacingMm: 10,
    },
    generatedParts: [],
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
