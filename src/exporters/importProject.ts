import type { ProjectData, SliceFoldProjectFile } from '../domain/project';
import { createCubeMesh } from '../geometry/mesh/createPrimitiveMesh';

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

const templateKinds = new Set([
  'open-box',
  'box-with-lid',
  'tray',
  'sleeve',
  'envelope',
  'regular-prism',
  'pyramid-frustum',
]);

function isPoint2D(value: unknown): boolean {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);
}

function isModel(value: unknown): boolean {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name)) return false;
  const source = value.source;
  const dimensions = value.dimensions;
  const transform = value.transform;
  const mesh = value.mesh;
  const bounds = value.bounds;
  const healthReport = value.healthReport;
  const importSettings = value.importSettings;

  const validSource =
    isRecord(source) &&
    ((source.kind === 'built-in' && source.primitive === 'cube') ||
      (source.kind === 'imported' && isString(source.fileName) && isString(source.format)));

  const validMesh =
    mesh === undefined ||
    (isRecord(mesh) &&
      Array.isArray(mesh.positionsMm) &&
      mesh.positionsMm.every(isFiniteNumber) &&
      Array.isArray(mesh.indices) &&
      mesh.indices.every((index) => Number.isInteger(index) && index >= 0));
  const validBounds =
    bounds === undefined ||
    (isRecord(bounds) &&
      Array.isArray(bounds.minMm) &&
      bounds.minMm.length === 3 &&
      bounds.minMm.every(isFiniteNumber) &&
      Array.isArray(bounds.maxMm) &&
      bounds.maxMm.length === 3 &&
      bounds.maxMm.every(isFiniteNumber));
  const validHealth =
    healthReport === undefined ||
    (isRecord(healthReport) &&
      isFiniteNumber(healthReport.triangleCount) &&
      isFiniteNumber(healthReport.openEdgeCount) &&
      isFiniteNumber(healthReport.nonManifoldEdgeCount) &&
      isFiniteNumber(healthReport.disconnectedShellCount) &&
      isFiniteNumber(healthReport.orientationIssueCount) &&
      isFiniteNumber(healthReport.weldedVertexCount) &&
      isFiniteNumber(healthReport.signedVolumeMm3) &&
      typeof healthReport.likelyInverted === 'boolean' &&
      typeof healthReport.inspected === 'boolean');
  const validImportSettings =
    importSettings === undefined ||
    (isRecord(importSettings) &&
      isString(importSettings.assumedUnit) &&
      isFiniteNumber(importSettings.sourceUnitToMm) &&
      isFiniteNumber(importSettings.mergeToleranceMm) &&
      isFiniteNumber(importSettings.removedZeroAreaTriangleCount) &&
      Array.isArray(importSettings.centreOffsetMm) &&
      importSettings.centreOffsetMm.length === 3 &&
      importSettings.centreOffsetMm.every(isFiniteNumber) &&
      isFiniteNumber(importSettings.dimensionScale));

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
    transform.scale.every(isFiniteNumber) &&
    validMesh &&
    validBounds &&
    validHealth &&
    validImportSettings
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
  const slot = value.slot;
  return (
    isString(value.id) &&
    isString(value.operation) &&
    operations.has(value.operation) &&
    typeof value.closed === 'boolean' &&
    Array.isArray(value.points) &&
    value.points.every(isPoint2D) &&
    (value.panelId === undefined || isString(value.panelId)) &&
    (value.edgeId === undefined || isString(value.edgeId)) &&
    (value.tabId === undefined || isString(value.tabId)) &&
    (value.contourRole === undefined ||
      value.contourRole === 'outer' ||
      value.contourRole === 'hole') &&
    (slot === undefined ||
      (isRecord(slot) &&
        isString(slot.pairedPartId) &&
        (slot.intersectionAxis === 'x' ||
          slot.intersectionAxis === 'y' ||
          slot.intersectionAxis === 'z') &&
        isFiniteNumber(slot.centreMm) &&
        isFiniteNumber(slot.widthMm) &&
        isFiniteNumber(slot.depthMm) &&
        (slot.direction === 'start' || slot.direction === 'end')))
  );
}

function isFabricationPart(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const slice = value.slice;
  const waffle = value.waffle;
  const folding = value.folding;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isFiniteNumber(value.thicknessMm) &&
    Array.isArray(value.paths) &&
    value.paths.every(isFabricationPath) &&
    (value.labels === undefined ||
      (Array.isArray(value.labels) &&
        value.labels.every(
          (label) =>
            isRecord(label) &&
            isString(label.id) &&
            isString(label.text) &&
            isPoint2D(label.position) &&
            (label.operation === 'engrave' || label.operation === 'guide') &&
            (label.entityId === undefined || isString(label.entityId)),
        ))) &&
    (slice === undefined ||
      (isRecord(slice) &&
        (slice.axis === 'x' || slice.axis === 'y' || slice.axis === 'z') &&
        isFiniteNumber(slice.positionMm) &&
        Number.isInteger(slice.planeIndex))) &&
    (waffle === undefined ||
      (isRecord(waffle) &&
        (waffle.family === 'a' || waffle.family === 'b') &&
        Number.isInteger(waffle.slotCount) &&
        (waffle.slotCount as number) >= 0)) &&
    (folding === undefined ||
      (isRecord(folding) && isString(folding.templateKind) && isStringArray(folding.panelIds)))
  );
}

function isTemplateFitSettings(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.templateKind) &&
    templateKinds.has(value.templateKind) &&
    (value.fitAxis === 'x' || value.fitAxis === 'y' || value.fitAxis === 'z') &&
    isFiniteNumber(value.clearanceMm) &&
    isFiniteNumber(value.profileToleranceMm) &&
    isRecord(value.parameters) &&
    Object.values(value.parameters).every(
      (parameter) =>
        typeof parameter === 'string' ||
        typeof parameter === 'boolean' ||
        isFiniteNumber(parameter),
    )
  );
}

function isProjectedProfile(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.sourceModelId) &&
    (value.fitAxis === 'x' || value.fitAxis === 'y' || value.fitAxis === 'z') &&
    Array.isArray(value.sourceHullPoints) &&
    value.sourceHullPoints.every(isPoint2D) &&
    Array.isArray(value.fittedPoints) &&
    value.fittedPoints.every(isPoint2D) &&
    isFiniteNumber(value.clearanceMm) &&
    isFiniteNumber(value.simplificationToleranceMm) &&
    isFiniteNumber(value.axisMinMm) &&
    isFiniteNumber(value.axisMaxMm) &&
    isFiniteNumber(value.widthMm) &&
    isFiniteNumber(value.heightMm) &&
    isFiniteNumber(value.depthMm)
  );
}

function isTemplateGenerationResult(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const preview = value.assembledPreview;
  return (
    isTemplateFitSettings(value.settings) &&
    isProjectedProfile(value.profile) &&
    Array.isArray(value.panels) &&
    value.panels.every(
      (panel) =>
        isRecord(panel) &&
        isString(panel.id) &&
        isString(panel.partId) &&
        isString(panel.name) &&
        isString(panel.role) &&
        Array.isArray(panel.outline) &&
        panel.outline.every(isPoint2D),
    ) &&
    Array.isArray(value.edges) &&
    value.edges.every(
      (edge) =>
        isRecord(edge) &&
        isString(edge.id) &&
        isString(edge.partId) &&
        isString(edge.panelAId) &&
        (edge.panelBId === undefined || isString(edge.panelBId)) &&
        (edge.disposition === 'boundary' ||
          edge.disposition === 'hinge' ||
          edge.disposition === 'seam') &&
        (edge.foldDirection === undefined ||
          edge.foldDirection === 'mountain' ||
          edge.foldDirection === 'valley') &&
        (edge.targetAngleDeg === undefined || isFiniteNumber(edge.targetAngleDeg)) &&
        (edge.pairLabel === undefined || isString(edge.pairLabel)) &&
        isPoint2D(edge.start) &&
        isPoint2D(edge.end),
    ) &&
    Array.isArray(value.tabs) &&
    value.tabs.every(
      (tab) =>
        isRecord(tab) &&
        isString(tab.id) &&
        isString(tab.partId) &&
        isString(tab.edgeId) &&
        isString(tab.ownerPanelId) &&
        tab.style === 'glue' &&
        isFiniteNumber(tab.depthMm) &&
        isFiniteNumber(tab.shoulderAngleDeg) &&
        typeof tab.enabled === 'boolean' &&
        isPoint2D(tab.baseStart) &&
        isPoint2D(tab.baseEnd) &&
        Array.isArray(tab.outline) &&
        tab.outline.every(isPoint2D),
    ) &&
    Array.isArray(value.parts) &&
    value.parts.every(isFabricationPart) &&
    Array.isArray(value.issues) &&
    value.issues.every(isValidationIssue) &&
    isRecord(preview) &&
    Array.isArray(preview.panels) &&
    preview.panels.every(
      (panel) =>
        isRecord(panel) &&
        isString(panel.id) &&
        isString(panel.partId) &&
        isString(panel.name) &&
        Array.isArray(panel.verticesMm) &&
        panel.verticesMm.every(
          (point) => Array.isArray(point) && point.length === 3 && point.every(isFiniteNumber),
        ),
    ) &&
    isString(value.algorithmVersion) &&
    isString(value.inputHash)
  );
}

function isValidationIssue(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    (value.severity === 'info' || value.severity === 'warning' || value.severity === 'error') &&
    isString(value.code) &&
    isString(value.message) &&
    isStringArray(value.affectedEntityIds) &&
    (value.suggestedAction === undefined || isString(value.suggestedAction))
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
    (value.kerfCompensation === undefined ||
      value.kerfCompensation === 'none' ||
      value.kerfCompensation === 'material' ||
      value.kerfCompensation === 'custom') &&
    (value.customKerfMm === undefined || isFiniteNumber(value.customKerfMm)) &&
    (value.foldLineOutput === undefined ||
      value.foldLineOutput === 'preserve' ||
      value.foldLineOutput === 'score' ||
      value.foldLineOutput === 'perforate') &&
    (value.perforationDashMm === undefined || isFiniteNumber(value.perforationDashMm)) &&
    (value.perforationGapMm === undefined || isFiniteNumber(value.perforationGapMm)) &&
    (value.labelFontSizeMm === undefined || isFiniteNumber(value.labelFontSizeMm)) &&
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

function isCurrentExportSettings(value: unknown): boolean {
  return (
    isExportSettings(value) &&
    isRecord(value) &&
    (value.kerfCompensation === 'none' ||
      value.kerfCompensation === 'material' ||
      value.kerfCompensation === 'custom') &&
    isFiniteNumber(value.customKerfMm) &&
    (value.foldLineOutput === 'preserve' ||
      value.foldLineOutput === 'score' ||
      value.foldLineOutput === 'perforate') &&
    isFiniteNumber(value.perforationDashMm) &&
    isFiniteNumber(value.perforationGapMm) &&
    isFiniteNumber(value.labelFontSizeMm)
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
    (value.generationIssues === undefined ||
      (Array.isArray(value.generationIssues) && value.generationIssues.every(isValidationIssue))) &&
    (value.foldingResult === undefined || isTemplateGenerationResult(value.foldingResult)) &&
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

  if (value.version !== 1 && value.version !== 2 && value.version !== 3) {
    throw new ProjectImportError(
      `Project version ${String(value.version)} is not supported by this build.`,
    );
  }

  if (!isProjectData(value.project)) {
    throw new ProjectImportError('The project file is incomplete or damaged.');
  }

  if (value.version === 3 && !isCurrentExportSettings(value.project.exportSettings)) {
    throw new ProjectImportError('The project file is incomplete or damaged.');
  }

  const project: ProjectData = {
    ...value.project,
    exportSettings: {
      ...value.project.exportSettings,
      kerfCompensation: value.project.exportSettings.kerfCompensation ?? 'none',
      customKerfMm:
        value.project.exportSettings.customKerfMm ?? value.project.materialProfileSnapshot.kerfMm,
      foldLineOutput: value.project.exportSettings.foldLineOutput ?? 'preserve',
      perforationDashMm: value.project.exportSettings.perforationDashMm ?? 2,
      perforationGapMm: value.project.exportSettings.perforationGapMm ?? 1,
      labelFontSizeMm: value.project.exportSettings.labelFontSizeMm ?? 3,
    },
  };

  return {
    format: 'slicefold-project',
    version: 3,
    project,
  };
}

export function parseProjectFile(source: string): ProjectData {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new ProjectImportError('The selected file is not valid JSON.');
  }

  const project = migrateProjectFile(parsed).project;
  if (project.model.source.kind === 'built-in' && (!project.model.mesh || !project.model.bounds)) {
    const primitive = createCubeMesh(project.model.dimensions.widthMm);
    return {
      ...project,
      model: {
        ...project.model,
        mesh: primitive.mesh,
        bounds: primitive.bounds,
        healthReport: primitive.healthReport,
      },
      generationIssues: project.generationIssues ?? [],
    };
  }
  return { ...project, generationIssues: project.generationIssues ?? [] };
}
