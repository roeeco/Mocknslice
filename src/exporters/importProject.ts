import { parsePapercraftRecord } from '../domain/papercraftSchema';
import { safeParse } from 'valibot';
import type {
  LegacyProjectData,
  MocknSliceProjectFileV8,
  MocknSliceProjectFileV9,
  ProjectData,
} from '../domain/project';
import { createCubeMesh } from '../geometry/mesh/createPrimitiveMesh';
import { modeSettingsSchema } from '../domain/modeSettingsSchema';
import {
  migrateLegacyModeParameters,
  normalizePanelComposerSettings,
} from '../domain/modeSettings';
import { upgradeLegacyGenerationRecord } from '../domain/generation';

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

function isVector3(value: unknown): boolean {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
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
  const unfolding = value.unfolding;
  const construction = value.construction;
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
      (isRecord(folding) && isString(folding.templateKind) && isStringArray(folding.panelIds))) &&
    (unfolding === undefined ||
      (isRecord(unfolding) &&
        Number.isInteger(unfolding.islandIndex) &&
        isStringArray(unfolding.faceIds))) &&
    (construction === undefined ||
      (isRecord(construction) &&
        isStringArray(construction.jointIds) &&
        ((isString(construction.panelId) && isPanelRole(construction.role)) ||
          (isStringArray(construction.panelIds) &&
            Array.isArray(construction.roles) &&
            construction.roles.every(isPanelRole)))))
  );
}

function isFoldTab(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.partId) &&
    isString(value.edgeId) &&
    isString(value.ownerPanelId) &&
    (value.style === 'glue' || value.style === 'press-fit') &&
    isFiniteNumber(value.depthMm) &&
    isFiniteNumber(value.shoulderAngleDeg) &&
    typeof value.enabled === 'boolean' &&
    isPoint2D(value.baseStart) &&
    isPoint2D(value.baseEnd) &&
    Array.isArray(value.outline) &&
    value.outline.every(isPoint2D) &&
    (value.receiverPanelId === undefined || isString(value.receiverPanelId)) &&
    (value.slotStart === undefined || isPoint2D(value.slotStart)) &&
    (value.slotEnd === undefined || isPoint2D(value.slotEnd))
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
    (value.connectionOverrides === undefined ||
      (Array.isArray(value.connectionOverrides) &&
        value.connectionOverrides.every(
          (override) =>
            isRecord(override) &&
            isString(override.id) &&
            isString(override.templateKind) &&
            templateKinds.has(override.templateKind) &&
            isString(override.connectionId) &&
            (override.treatment === 'crease' || override.treatment === 'cut') &&
            (override.closure === 'none' ||
              override.closure === 'glue-tab' ||
              override.closure === 'press-fit') &&
            (override.tabOwnerPanelId === undefined || isString(override.tabOwnerPanelId)),
        ))) &&
    (value.boundaryGlueTabs === undefined ||
      (Array.isArray(value.boundaryGlueTabs) &&
        value.boundaryGlueTabs.every(
          (tab) =>
            isRecord(tab) &&
            isString(tab.id) &&
            isString(tab.templateKind) &&
            templateKinds.has(tab.templateKind) &&
            isString(tab.edgeId) &&
            isString(tab.ownerPanelId),
        ))) &&
    (value.glueTabDepthMm === undefined || isFiniteNumber(value.glueTabDepthMm)) &&
    isRecord(value.parameters) &&
    Object.values(value.parameters).every(
      (parameter) =>
        typeof parameter === 'string' ||
        typeof parameter === 'boolean' ||
        isFiniteNumber(parameter),
    )
  );
}

function isEditableAssemblyEdge(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.id) &&
    (value.kind === 'connection' || value.kind === 'boundary') &&
    isString(value.panelAId) &&
    (value.panelBId === undefined || isString(value.panelBId)) &&
    isVector3(value.startMm) &&
    isVector3(value.endMm) &&
    typeof value.editable === 'boolean' &&
    (value.unavailableReason === undefined || isString(value.unavailableReason))
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
    value.tabs.every(isFoldTab) &&
    Array.isArray(value.connections) &&
    value.connections.every(
      (connection) =>
        isRecord(connection) &&
        isString(connection.id) &&
        isString(connection.panelAId) &&
        isString(connection.panelBId) &&
        isRecord(connection.edgeA) &&
        isPoint2D(connection.edgeA.start) &&
        isPoint2D(connection.edgeA.end) &&
        isRecord(connection.edgeB) &&
        isPoint2D(connection.edgeB.start) &&
        isPoint2D(connection.edgeB.end) &&
        (connection.disposition === 'hinge' || connection.disposition === 'seam') &&
        (connection.closure === 'none' ||
          connection.closure === 'glue-tab' ||
          connection.closure === 'press-fit' ||
          connection.closure === 'openable-flap') &&
        typeof connection.required === 'boolean' &&
        isStringArray(connection.tabIds),
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
        ) &&
        (panel.holesVerticesMm === undefined ||
          (Array.isArray(panel.holesVerticesMm) &&
            panel.holesVerticesMm.every((hole) => Array.isArray(hole) && hole.every(isVector3)))),
    ) &&
    (value.editableEdges === undefined ||
      (Array.isArray(value.editableEdges) && value.editableEdges.every(isEditableAssemblyEdge))) &&
    isString(value.algorithmVersion) &&
    isString(value.inputHash)
  );
}

function isMeshUnfoldSettings(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.strategy === 'automatic' || value.strategy === 'manual') &&
    Number.isInteger(value.rootFaceIndex) &&
    isStringArray(value.manualSeamKeys) &&
    isFiniteNumber(value.tabDepthMm) &&
    Number.isInteger(value.maximumFaceCount) &&
    Number.isInteger(value.searchAttempts)
  );
}

function isMeshUnfoldResult(value: unknown): boolean {
  return (
    isRecord(value) &&
    isMeshUnfoldSettings(value.settings) &&
    Array.isArray(value.faces) &&
    value.faces.every(
      (face) =>
        isRecord(face) &&
        isString(face.id) &&
        isString(face.partId) &&
        Number.isInteger(face.islandIndex) &&
        Number.isInteger(face.faceIndex) &&
        Array.isArray(face.sourceVertexIndices) &&
        face.sourceVertexIndices.length === 3 &&
        face.sourceVertexIndices.every(Number.isInteger) &&
        Array.isArray(face.points2D) &&
        face.points2D.length === 3 &&
        face.points2D.every(isPoint2D) &&
        Array.isArray(face.flatVerticesMm) &&
        face.flatVerticesMm.length === 3 &&
        face.flatVerticesMm.every(isVector3) &&
        Array.isArray(face.sourceVerticesMm) &&
        face.sourceVerticesMm.length === 3 &&
        face.sourceVerticesMm.every(isVector3),
    ) &&
    Array.isArray(value.edges) &&
    value.edges.every(
      (edge) =>
        isRecord(edge) &&
        isString(edge.id) &&
        isString(edge.key) &&
        Number.isInteger(edge.vertexA) &&
        Number.isInteger(edge.vertexB) &&
        Number.isInteger(edge.faceAIndex) &&
        (edge.faceBIndex === undefined || Number.isInteger(edge.faceBIndex)) &&
        (edge.disposition === 'boundary' ||
          edge.disposition === 'hinge' ||
          edge.disposition === 'seam' ||
          edge.disposition === 'auto-seam') &&
        (edge.foldDirection === undefined ||
          edge.foldDirection === 'mountain' ||
          edge.foldDirection === 'valley') &&
        (edge.dihedralDeg === undefined || isFiniteNumber(edge.dihedralDeg)) &&
        (edge.pairLabel === undefined || isString(edge.pairLabel)),
    ) &&
    Array.isArray(value.tabs) &&
    value.tabs.every(isFoldTab) &&
    Array.isArray(value.hinges) &&
    value.hinges.every(
      (hinge) =>
        isRecord(hinge) &&
        isString(hinge.id) &&
        isString(hinge.parentFaceId) &&
        isString(hinge.childFaceId) &&
        Number.isInteger(hinge.vertexA) &&
        Number.isInteger(hinge.vertexB) &&
        isFiniteNumber(hinge.foldAngleDeg),
    ) &&
    Array.isArray(value.islands) &&
    value.islands.every(
      (island) =>
        isRecord(island) &&
        isString(island.id) &&
        Number.isInteger(island.index) &&
        isString(island.partId) &&
        isStringArray(island.faceIds),
    ) &&
    Array.isArray(value.overlapPairs) &&
    value.overlapPairs.every(
      (overlap) =>
        isRecord(overlap) &&
        isString(overlap.faceAId) &&
        isString(overlap.faceBId) &&
        Number.isInteger(overlap.islandIndex),
    ) &&
    Array.isArray(value.parts) &&
    value.parts.every(isFabricationPart) &&
    Array.isArray(value.issues) &&
    value.issues.every(isValidationIssue) &&
    isString(value.algorithmVersion) &&
    isString(value.inputHash)
  );
}

const panelRoles = new Set(['base', 'front', 'back', 'left', 'right', 'lid']);

function isPanelRole(value: unknown): boolean {
  return isString(value) && (panelRoles.has(value) || /^divider-\d+$/.test(value));
}
const panelEdges = new Set(['bottom', 'right', 'top', 'left']);
const panelJointLocations = new Set([...panelEdges, 'face']);
const panelBoundaryJointKinds = new Set(['butt', 'finger', 'tab-slot']);
const panelJointKinds = new Set([...panelBoundaryJointKinds, 'crease', 'half-lap']);
const panelConnectionKeys = new Set([
  'base-front',
  'base-back',
  'base-left',
  'base-right',
  'front-left',
  'front-right',
  'back-left',
  'back-right',
  'lid-front',
  'lid-back',
  'lid-left',
  'lid-right',
]);
const panelProfileKinds = new Set(['flat', 'arch', 'gable', 'stepped']);

function isPanelConnectionOverrides(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.entries(value).every(
      ([key, override]) =>
        panelConnectionKeys.has(key) &&
        isRecord(override) &&
        (override.jointKind === 'butt' ||
          override.jointKind === 'finger' ||
          override.treatment === 'butt' ||
          override.treatment === 'finger' ||
          override.treatment === 'crease') &&
        (override.clearanceMm === undefined || isFiniteNumber(override.clearanceMm)),
    )
  );
}

function isPanelProfiles(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.front) &&
    panelProfileKinds.has(value.front) &&
    isString(value.back) &&
    panelProfileKinds.has(value.back)
  );
}

function isPanelConstructionResult(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const settings = value.settings;
  const material = value.material;
  const preview = value.assembledPreview;
  return (
    isRecord(settings) &&
    isFiniteNumber(settings.innerWidthMm) &&
    isFiniteNumber(settings.innerDepthMm) &&
    isFiniteNumber(settings.innerHeightMm) &&
    isString(settings.jointKind) &&
    panelBoundaryJointKinds.has(settings.jointKind) &&
    isFiniteNumber(settings.fingerWidthMm) &&
    isFiniteNumber(settings.clearanceMm) &&
    typeof settings.includeLid === 'boolean' &&
    (settings.panelThicknessMm === undefined || isFiniteNumber(settings.panelThicknessMm)) &&
    (settings.dividerThicknessMm === undefined || isFiniteNumber(settings.dividerThicknessMm)) &&
    (settings.lidThicknessMm === undefined || isFiniteNumber(settings.lidThicknessMm)) &&
    (settings.dividerCount === undefined || Number.isInteger(settings.dividerCount)) &&
    (settings.dividerAxis === undefined ||
      settings.dividerAxis === 'width' ||
      settings.dividerAxis === 'depth') &&
    (settings.widthDividerCount === undefined || Number.isInteger(settings.widthDividerCount)) &&
    (settings.depthDividerCount === undefined || Number.isInteger(settings.depthDividerCount)) &&
    (settings.connectionOverrides === undefined ||
      isPanelConnectionOverrides(settings.connectionOverrides)) &&
    (settings.glueTabDepthMm === undefined || isFiniteNumber(settings.glueTabDepthMm)) &&
    (settings.boundaryGlueTabs === undefined ||
      (Array.isArray(settings.boundaryGlueTabs) &&
        settings.boundaryGlueTabs.every(
          (tab) =>
            isRecord(tab) && isString(tab.id) && isString(tab.ownerPanelId) && isString(tab.edgeId),
        ))) &&
    (settings.panelProfiles === undefined || isPanelProfiles(settings.panelProfiles)) &&
    isRecord(material) &&
    isString(material.id) &&
    isString(material.category) &&
    isFiniteNumber(material.thicknessMm) &&
    isFiniteNumber(material.kerfMm) &&
    Array.isArray(value.panels) &&
    value.panels.every(
      (panel) =>
        isRecord(panel) &&
        isString(panel.id) &&
        isString(panel.partId) &&
        isString(panel.name) &&
        isPanelRole(panel.role) &&
        isFiniteNumber(panel.widthMm) &&
        isFiniteNumber(panel.heightMm) &&
        Array.isArray(panel.outline) &&
        panel.outline.every(isPoint2D) &&
        isRecord(panel.edgeJointIds) &&
        Object.entries(panel.edgeJointIds).every(
          ([edge, jointId]) => panelEdges.has(edge) && isString(jointId),
        ),
    ) &&
    Array.isArray(value.joints) &&
    value.joints.every(
      (joint) =>
        isRecord(joint) &&
        isString(joint.id) &&
        (joint.connectionKey === undefined ||
          (isString(joint.connectionKey) && panelConnectionKeys.has(joint.connectionKey))) &&
        isString(joint.kind) &&
        panelJointKinds.has(joint.kind) &&
        isString(joint.panelAId) &&
        isString(joint.panelBId) &&
        isString(joint.edgeA) &&
        panelJointLocations.has(joint.edgeA) &&
        isString(joint.edgeB) &&
        panelJointLocations.has(joint.edgeB) &&
        isFiniteNumber(joint.sharedLengthMm) &&
        Number.isInteger(joint.fingerCount) &&
        isFiniteNumber(joint.clearanceMm) &&
        isString(joint.pairLabel) &&
        (joint.tabOwnerPanelId === undefined || isString(joint.tabOwnerPanelId)) &&
        (joint.tabIds === undefined || isStringArray(joint.tabIds)) &&
        (joint.receiverCentreAMm === undefined || isPoint2D(joint.receiverCentreAMm)) &&
        (joint.receiverCentreMm === undefined || isPoint2D(joint.receiverCentreMm)),
    ) &&
    Array.isArray(value.parts) &&
    value.parts.every(isFabricationPart) &&
    (value.tabs === undefined || (Array.isArray(value.tabs) && value.tabs.every(isFoldTab))) &&
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
        panel.verticesMm.every(isVector3) &&
        (panel.holesVerticesMm === undefined ||
          (Array.isArray(panel.holesVerticesMm) &&
            panel.holesVerticesMm.every((hole) => Array.isArray(hole) && hole.every(isVector3)))),
    ) &&
    (value.editableEdges === undefined ||
      (Array.isArray(value.editableEdges) && value.editableEdges.every(isEditableAssemblyEdge))) &&
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

function isCanonicalGenerationRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.signatureVersion === 2 || value.signatureVersion === 3) &&
    isString(value.mode) &&
    fabricationModes.has(value.mode) &&
    isString(value.inputHash) &&
    isString(value.resultHash) &&
    isString(value.algorithmVersion) &&
    isString(value.generatedAt)
  );
}

function isLegacyGenerationRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    isString(value.mode) &&
    fabricationModes.has(value.mode) &&
    isString(value.sourceModelId) &&
    isString(value.sourceMeshHash) &&
    isString(value.settingsHash) &&
    isString(value.materialHash) &&
    isString(value.resultHash) &&
    isString(value.algorithmVersion) &&
    isString(value.generatedAt)
  );
}

function isLegacyProjectData(value: unknown): value is LegacyProjectData {
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
    (value.generationRecord === undefined ||
      isCanonicalGenerationRecord(value.generationRecord) ||
      isLegacyGenerationRecord(value.generationRecord)) &&
    (value.generationIssues === undefined ||
      (Array.isArray(value.generationIssues) && value.generationIssues.every(isValidationIssue))) &&
    (value.foldingResult === undefined || isTemplateGenerationResult(value.foldingResult)) &&
    (value.unfoldingResult === undefined || isMeshUnfoldResult(value.unfoldingResult)) &&
    (value.panelConstructionResult === undefined ||
      isPanelConstructionResult(value.panelConstructionResult)) &&
    Array.isArray(value.sheetLayouts) &&
    value.sheetLayouts.every(isSheetLayout) &&
    isExportSettings(value.exportSettings) &&
    isStringArray(value.acknowledgedWarningIds)
  );
}

function isCurrentProjectData(value: unknown): value is ProjectData {
  if (
    !isRecord(value) ||
    value.modeParameters !== undefined ||
    !safeParse(modeSettingsSchema, value.modeSettings).success
  ) {
    return false;
  }
  if (
    value.generationRecord !== undefined &&
    !isCanonicalGenerationRecord(value.generationRecord)
  ) {
    return false;
  }
  return isLegacyProjectData({ ...value, modeParameters: {} });
}

function withCurrentExportSettings(project: LegacyProjectData): LegacyProjectData;
function withCurrentExportSettings(project: ProjectData): ProjectData;
function withCurrentExportSettings(project: LegacyProjectData | ProjectData) {
  return {
    ...project,
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

function withCurrentPanelSettings(project: ProjectData): ProjectData {
  const replacedTabSlot =
    (project.modeSettings.panelConstruction as { jointKind: string }).jointKind === 'tab-slot';
  return {
    ...project,
    modeSettings: {
      ...project.modeSettings,
      panelConstruction: normalizePanelComposerSettings(
        project.modeSettings.panelConstruction,
        project.materialProfileSnapshot,
      ),
    },
    ...(replacedTabSlot
      ? {
          generationIssues: [
            ...(project.generationIssues ?? []).filter(
              (issue) => issue.code !== 'PANEL_TAB_SLOT_REPLACED',
            ),
            {
              id: 'panel-tab-slot-replaced',
              severity: 'warning' as const,
              code: 'PANEL_TAB_SLOT_REPLACED',
              message: 'Tabs and through-slots were replaced with complementary finger joints.',
              affectedEntityIds: ['panel-construction'],
              suggestedAction: 'Review the panel settings and regenerate before fabrication.',
            },
          ],
        }
      : project.generationIssues
        ? { generationIssues: project.generationIssues }
        : {}),
  };
}

function upgradeV7ConnectionContracts(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const upgraded = structuredClone(value);
  if (!isRecord(upgraded) || !isRecord(upgraded.project)) return upgraded;
  const modeSettings = upgraded.project.modeSettings;
  if (!isRecord(modeSettings)) return upgraded;

  const foldSettings = modeSettings.foldTemplate;
  if (isRecord(foldSettings)) {
    foldSettings.connectionOverrides ??= [];
    foldSettings.boundaryGlueTabs ??= [];
    foldSettings.glueTabDepthMm ??= 8;
  }

  const panelSettings = modeSettings.panelConstruction;
  if (isRecord(panelSettings)) {
    panelSettings.connectionOverrides ??= {};
    panelSettings.panelProfiles ??= { front: 'flat', back: 'flat' };
    panelSettings.glueTabDepthMm ??= 8;
    panelSettings.boundaryGlueTabs ??= [];
    if (isRecord(panelSettings.connectionOverrides)) {
      panelSettings.connectionOverrides = Object.fromEntries(
        Object.entries(panelSettings.connectionOverrides).map(([key, rawOverride]) => {
          if (!isRecord(rawOverride) || rawOverride.treatment !== undefined) {
            return [key, rawOverride];
          }
          const { jointKind, ...shared } = rawOverride;
          return [key, { ...shared, treatment: jointKind }];
        }),
      );
    }
  }

  const result = upgraded.project.panelConstructionResult;
  if (isRecord(result) && isRecord(result.settings)) {
    result.settings.glueTabDepthMm ??= 8;
    result.settings.boundaryGlueTabs ??= [];
    if (isRecord(result.settings.connectionOverrides)) {
      result.settings.connectionOverrides = Object.fromEntries(
        Object.entries(result.settings.connectionOverrides).map(([key, rawOverride]) => {
          if (!isRecord(rawOverride) || rawOverride.treatment !== undefined) {
            return [key, rawOverride];
          }
          const { jointKind, ...shared } = rawOverride;
          return [key, { ...shared, treatment: jointKind }];
        }),
      );
    }
  }
  return upgraded;
}

function markMigratedTopologyStale(project: ProjectData): ProjectData {
  if (
    project.fabricationMode !== 'fold-template' &&
    project.fabricationMode !== 'panel-construction'
  ) {
    return project;
  }
  if (project.generatedParts.length === 0) return project;
  const projectWithoutGenerationRecord = { ...project };
  delete projectWithoutGenerationRecord.generationRecord;
  return {
    ...projectWithoutGenerationRecord,
    generationIssues: [
      ...(project.generationIssues ?? []).filter(
        (issue) => issue.code !== 'CONNECTION_TOPOLOGY_REGENERATION_REQUIRED',
      ),
      {
        id: 'connection-topology-regeneration-required',
        severity: 'warning',
        code: 'CONNECTION_TOPOLOGY_REGENERATION_REQUIRED',
        message:
          'This saved output uses the earlier connection topology and must be regenerated before fabrication.',
        affectedEntityIds: [project.fabricationMode],
        suggestedAction: 'Review the connection settings, then regenerate the fabrication parts.',
      },
    ],
  };
}

export function migrateProjectFile(
  value: unknown,
): MocknSliceProjectFileV8 | MocknSliceProjectFileV9 {
  const originalVersion = isRecord(value) ? value.version : undefined;
  value = originalVersion === 7 ? upgradeV7ConnectionContracts(value) : value;
  if (
    !isRecord(value) ||
    (value.format !== 'slicefold-project' && value.format !== 'mocknslice-project')
  ) {
    throw new ProjectImportError('This file is not a MocknSlice project.');
  }

  const legacy = value.format === 'slicefold-project';
  if (
    (legacy &&
      value.version !== 1 &&
      value.version !== 2 &&
      value.version !== 3 &&
      value.version !== 4 &&
      value.version !== 5) ||
    (!legacy &&
      value.version !== 6 &&
      value.version !== 7 &&
      value.version !== 8 &&
      value.version !== 9)
  ) {
    throw new ProjectImportError(
      `Project version ${String(value.version)} is not supported by this build.`,
    );
  }

  if (value.version === 9) {
    if (
      !isCurrentProjectData(value.project) ||
      !isCurrentExportSettings(value.project.exportSettings)
    )
      throw new ProjectImportError('The v9 project file is incomplete or damaged.');
    const project = withCurrentPanelSettings(withCurrentExportSettings(value.project));
    try {
      if (project.papercraft)
        project.papercraft = parsePapercraftRecord(project.papercraft, project, isMeshUnfoldResult);
    } catch (error) {
      throw new ProjectImportError(
        error instanceof Error ? error.message : 'Invalid papercraft project.',
      );
    }
    return { format: 'mocknslice-project', version: 9, project };
  }
  if (value.version === 7 || value.version === 8) {
    if (
      !isCurrentProjectData(value.project) ||
      !isCurrentExportSettings(value.project.exportSettings)
    ) {
      throw new ProjectImportError('The project file is incomplete or damaged.');
    }
    return {
      format: 'mocknslice-project',
      version: 8,
      project:
        value.version === 7
          ? markMigratedTopologyStale(
              withCurrentPanelSettings(withCurrentExportSettings(value.project)),
            )
          : withCurrentPanelSettings(withCurrentExportSettings(value.project)),
    };
  }

  if (!isLegacyProjectData(value.project)) {
    throw new ProjectImportError('The project file is incomplete or damaged.');
  }

  if (
    (value.version === 3 || value.version === 4 || value.version === 5 || value.version === 6) &&
    !isCurrentExportSettings(value.project.exportSettings)
  ) {
    throw new ProjectImportError('The project file is incomplete or damaged.');
  }

  const legacyProject = withCurrentExportSettings(value.project);
  const { modeParameters, ...sharedProject } = legacyProject;
  let modeSettings: ProjectData['modeSettings'];
  try {
    modeSettings = migrateLegacyModeParameters(
      modeParameters,
      legacyProject.materialProfileSnapshot,
      legacyProject.model.dimensions,
    );
  } catch {
    throw new ProjectImportError('The project file is incomplete or damaged.');
  }
  const project: ProjectData = {
    ...sharedProject,
    modeSettings,
    ...(modeParameters.panelJointKind === 'tab-slot'
      ? {
          generationIssues: [
            ...(sharedProject.generationIssues ?? []).filter(
              (issue) => issue.code !== 'PANEL_TAB_SLOT_REPLACED',
            ),
            {
              id: 'panel-tab-slot-replaced',
              severity: 'warning' as const,
              code: 'PANEL_TAB_SLOT_REPLACED',
              message: 'Tabs and through-slots were replaced with complementary finger joints.',
              affectedEntityIds: ['panel-construction'],
              suggestedAction: 'Review the panel settings and regenerate before fabrication.',
            },
          ],
        }
      : {}),
  };
  const runtimeProject =
    project.model.source.kind === 'built-in' && (!project.model.mesh || !project.model.bounds)
      ? (() => {
          const primitive = createCubeMesh(project.model.dimensions.widthMm);
          return {
            ...project,
            model: {
              ...project.model,
              mesh: primitive.mesh,
              bounds: primitive.bounds,
              healthReport: primitive.healthReport,
            },
          };
        })()
      : project;

  return {
    format: 'mocknslice-project',
    version: 8,
    project: markMigratedTopologyStale(
      upgradeLegacyGenerationRecord(legacyProject, runtimeProject),
    ),
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
