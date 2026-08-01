import type { ProjectData, SliceFoldProjectFile } from '../domain/project';

export class ProjectImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectImportError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

const fabricationModes = new Set([
  'stacked-slices',
  'waffle-slices',
  'fold-template',
  'mesh-unfold',
  'panel-construction',
]);

const operations = new Set([
  'cut',
  'score',
  'mountain-fold',
  'valley-fold',
  'perforate',
  'engrave',
  'guide',
]);

function isModel(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name)) return false;
  const source = value.source;
  const dimensions = value.dimensions;
  const transform = value.transform;

  const validSource =
    isRecord(source) &&
    ((source.kind === 'built-in' && source.primitive === 'cube') ||
      (source.kind === 'imported' && isString(source.fileName) && isString(source.format)));

  return (
    validSource &&
    isRecord(dimensions) &&
    isFiniteNumber(dimensions.widthMm) &&
    isFiniteNumber(dimensions.heightMm) &&
    isFiniteNumber(dimensions.depthMm) &&
    isRecord(transform) &&
    Array.isArray(transform.positionMm) &&
    transform.positionMm.length === 3 &&
    transform.positionMm.every(isFiniteNumber) &&
    Array.isArray(transform.rotationDeg) &&
    transform.rotationDeg.length === 3 &&
    transform.rotationDeg.every(isFiniteNumber) &&
    Array.isArray(transform.scale) &&
    transform.scale.length === 3 &&
    transform.scale.every(isFiniteNumber)
  );
}

function isMaterial(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.category) &&
    isFiniteNumber(value.thicknessMm) &&
    isFiniteNumber(value.kerfMm) &&
    isFiniteNumber(value.clearanceMm) &&
    isFiniteNumber(value.defaultSheetWidthMm) &&
    isFiniteNumber(value.defaultSheetHeightMm)
  );
}

function isFabricationPath(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.operation) &&
    operations.has(value.operation) &&
    typeof value.closed === 'boolean' &&
    Array.isArray(value.points) &&
    value.points.every(
      (point) => isRecord(point) && isFiniteNumber(point.x) && isFiniteNumber(point.y),
    )
  );
}

function isFabricationPart(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isFiniteNumber(value.thicknessMm) &&
    Array.isArray(value.paths) &&
    value.paths.every(isFabricationPath)
  );
}

function isSheetLayout(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isFiniteNumber(value.widthMm) &&
    isFiniteNumber(value.heightMm) &&
    isFiniteNumber(value.marginMm) &&
    isFiniteNumber(value.spacingMm) &&
    Array.isArray(value.placements) &&
    value.placements.every(
      (placement) =>
        isRecord(placement) &&
        isString(placement.partId) &&
        isFiniteNumber(placement.x) &&
        isFiniteNumber(placement.y) &&
        isFiniteNumber(placement.rotationDeg),
    )
  );
}

function isExportSettings(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.includeLabels === 'boolean' &&
    typeof value.includeRegistrationMarks === 'boolean' &&
    typeof value.includeSheetBoundary === 'boolean' &&
    Array.isArray(value.operationStyles) &&
    value.operationStyles.every(
      (style) =>
        isRecord(style) &&
        isString(style.operation) &&
        operations.has(style.operation) &&
        isString(style.stroke) &&
        isFiniteNumber(style.strokeWidthMm),
    )
  );
}

function isProjectData(value: unknown): value is ProjectData {
  if (!isRecord(value)) return false;

  const metadata = value.metadata;
  const model = value.model;
  const material = value.materialProfileSnapshot;

  return (
    isRecord(metadata) &&
    isString(metadata.id) &&
    isString(metadata.name) &&
    isString(metadata.createdAt) &&
    isString(metadata.updatedAt) &&
    isModel(model) &&
    isMaterial(material) &&
    isString(value.fabricationMode) &&
    fabricationModes.has(value.fabricationMode) &&
    isRecord(value.modeParameters) &&
    Object.values(value.modeParameters).every(
      (parameter) =>
        typeof parameter === 'string' ||
        typeof parameter === 'boolean' ||
        isFiniteNumber(parameter),
    ) &&
    Array.isArray(value.generatedParts) &&
    value.generatedParts.every(isFabricationPart) &&
    Array.isArray(value.sheetLayouts) &&
    value.sheetLayouts.every(isSheetLayout) &&
    isExportSettings(value.exportSettings) &&
    isStringArray(value.acknowledgedWarningIds)
  );
}

function migrateProjectFile(value: unknown): SliceFoldProjectFile {
  if (!isRecord(value) || value.format !== 'slicefold-project') {
    throw new ProjectImportError('This file is not a SliceFold project.');
  }

  if (value.version !== 1) {
    throw new ProjectImportError(
      `Project version ${String(value.version)} is not supported by this build.`,
    );
  }

  if (!isProjectData(value.project)) {
    throw new ProjectImportError('The project file is incomplete or damaged.');
  }

  return {
    format: 'slicefold-project',
    version: 1,
    project: value.project,
  };
}

export function parseProjectFile(source: string): ProjectData {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new ProjectImportError('The selected file is not valid JSON.');
  }

  return migrateProjectFile(parsed).project;
}
