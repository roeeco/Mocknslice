import { hashSerializable } from './canonicalHash';
import type { FabricationMode, SliceAxis } from './fabrication';
import type { TemplateFitSettings } from './folding';
import type { Bounds3D, SerializableTriangleMesh } from './geometry';
import type {
  CurrentPanelJointKind,
  PanelConnectionOverrides,
  PanelBoundaryGlueTab,
  PanelConstructionMaterial,
  PanelConstructionSettings,
  PanelProfiles,
} from './panelConstruction';
import {
  DEFAULT_PANEL_PROFILES,
  maximumPanelDividerCount,
  PANEL_CONNECTION_KEYS,
  PANEL_PROFILE_KINDS,
} from './panelConstruction';
import type { PanelFeature } from './modeSettings';
import type {
  BoundaryGlueTab,
  FoldingConnectionOverride,
  PanelConnectionTreatment,
} from './connections';
import type { ProjectData } from './project';
import type { StackedSliceSettings, WaffleSliceSettings } from './slicing';
import type { MeshUnfoldSettings } from './unfolding';

export const PANEL_CONSTRUCTION_SOURCE_ID = 'panel-construction';

export class GenerationInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerationInputError';
  }
}

export interface StackedGenerationInput {
  mode: 'stacked-slices';
  payload: {
    mesh: SerializableTriangleMesh;
    bounds: Bounds3D;
    modelId: string;
    settings: StackedSliceSettings;
  };
}

export interface WaffleGenerationInput {
  mode: 'waffle-slices';
  payload: {
    mesh: SerializableTriangleMesh;
    bounds: Bounds3D;
    modelId: string;
    settings: WaffleSliceSettings;
  };
}

export interface FoldingGenerationInput {
  mode: 'fold-template';
  payload: { materialThicknessMm: number; settings: TemplateFitSettings };
}

export interface MeshUnfoldGenerationInput {
  mode: 'mesh-unfold';
  payload: {
    mesh: SerializableTriangleMesh;
    modelId: string;
    materialThicknessMm: number;
    settings: MeshUnfoldSettings;
  };
}

export interface PanelGenerationSettings extends PanelConstructionSettings {
  jointKind: CurrentPanelJointKind;
  panelThicknessMm: number;
  dividerThicknessMm: number;
  lidThicknessMm: number;
  widthDividerCount: number;
  depthDividerCount: number;
  connectionOverrides: PanelConnectionOverrides;
  panelProfiles: PanelProfiles;
  features: PanelFeature[];
  glueTabDepthMm: number;
  boundaryGlueTabs: PanelBoundaryGlueTab[];
}

export interface PanelGenerationInput {
  mode: 'panel-construction';
  payload: {
    sourceId: typeof PANEL_CONSTRUCTION_SOURCE_ID;
    material: PanelConstructionMaterial;
    settings: PanelGenerationSettings;
  };
}

export type CanonicalGenerationInput =
  | StackedGenerationInput
  | WaffleGenerationInput
  | FoldingGenerationInput
  | MeshUnfoldGenerationInput
  | PanelGenerationInput;

function finite(value: number, name: string): number {
  if (!Number.isFinite(value)) throw new GenerationInputError(`${name} must be a finite number.`);
  return value;
}

function nonEmpty(value: string, name: string): string {
  if (value.trim().length === 0) throw new GenerationInputError(`${name} must not be empty.`);
  return value;
}

function positive(value: number, name: string): number {
  const result = finite(value, name);
  if (result <= 0) throw new GenerationInputError(`${name} must be positive.`);
  return result;
}

function nonNegative(value: number, name: string): number {
  const result = finite(value, name);
  if (result < 0) throw new GenerationInputError(`${name} cannot be negative.`);
  return result;
}

function integer(value: number, name: string, minimum: number): number {
  const result = finite(value, name);
  if (!Number.isInteger(result) || result < minimum) {
    throw new GenerationInputError(`${name} must be an integer of at least ${minimum}.`);
  }
  return result;
}

function enumValue<T extends string>(value: T, allowed: readonly T[], name: string): T {
  if (!allowed.includes(value)) throw new GenerationInputError(`${name} is invalid.`);
  return value;
}

function requireModel(project: ProjectData) {
  if (!project.model.mesh || !project.model.bounds) {
    throw new GenerationInputError('The active fabrication mode requires a source mesh.');
  }
  return { mesh: project.model.mesh, bounds: project.model.bounds, modelId: project.model.id };
}

function sliceAxis(value: SliceAxis, name: string): SliceAxis {
  return enumValue(value, ['x', 'y', 'z'], name);
}

function stackedSettings(project: ProjectData): StackedSliceSettings {
  const settings = project.modeSettings.stackedSlices;
  return {
    axis: sliceAxis(settings.axis, 'Slice axis'),
    spacingMm: positive(settings.spacingMm, 'Slice spacing'),
    thicknessMm: positive(settings.thicknessMm, 'Slice thickness'),
    contourEpsilonMm: positive(settings.contourEpsilonMm, 'Contour tolerance'),
  };
}

function waffleSettings(project: ProjectData): WaffleSliceSettings {
  const settings = project.modeSettings.waffleSlices;
  return {
    primaryAxis: sliceAxis(settings.primaryAxis, 'Primary waffle axis'),
    secondaryAxis: sliceAxis(settings.secondaryAxis, 'Secondary waffle axis'),
    primarySpacingMm: positive(settings.primarySpacingMm, 'Primary waffle spacing'),
    secondarySpacingMm: positive(settings.secondarySpacingMm, 'Secondary waffle spacing'),
    thicknessMm: positive(settings.thicknessMm, 'Waffle thickness'),
    clearanceMm: nonNegative(settings.clearanceMm, 'Waffle clearance'),
    contourEpsilonMm: positive(settings.contourEpsilonMm, 'Contour tolerance'),
    slotPattern: enumValue(
      settings.slotPattern,
      ['by-family', 'alternating'],
      'Waffle slot pattern',
    ),
    reverseSlots: settings.reverseSlots,
  };
}

function foldSettings(project: ProjectData): TemplateFitSettings {
  const settings = project.modeSettings.foldTemplate;
  const activeOverrides = settings.connectionOverrides
    .filter((override) => override.templateKind === settings.templateKind)
    .map((override): FoldingConnectionOverride => ({
      id: nonEmpty(override.id, 'Fold connection override ID'),
      templateKind: override.templateKind,
      connectionId: nonEmpty(override.connectionId, 'Fold connection ID'),
      treatment: enumValue(override.treatment, ['crease', 'cut'], 'Fold connection treatment'),
      closure: enumValue(
        override.closure,
        ['none', 'glue-tab', 'press-fit'],
        'Fold connection closure',
      ),
      ...(override.tabOwnerPanelId
        ? { tabOwnerPanelId: nonEmpty(override.tabOwnerPanelId, 'Fold tab owner panel ID') }
        : {}),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const activeBoundaryTabs = settings.boundaryGlueTabs
    .filter((tab) => tab.templateKind === settings.templateKind)
    .map((tab): BoundaryGlueTab => ({
      id: nonEmpty(tab.id, 'Fold boundary tab ID'),
      templateKind: tab.templateKind,
      edgeId: nonEmpty(tab.edgeId, 'Fold boundary edge ID'),
      ownerPanelId: nonEmpty(tab.ownerPanelId, 'Fold boundary owner panel ID'),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(activeOverrides.map((override) => override.id)).size !== activeOverrides.length) {
    throw new GenerationInputError('Fold connection override IDs must be unique.');
  }
  if (new Set(activeBoundaryTabs.map((tab) => tab.id)).size !== activeBoundaryTabs.length) {
    throw new GenerationInputError('Fold boundary tab IDs must be unique.');
  }
  return {
    templateKind: enumValue(
      settings.templateKind,
      [
        'open-box',
        'box-with-lid',
        'tray',
        'sleeve',
        'envelope',
        'regular-prism',
        'pyramid-frustum',
      ],
      'Template kind',
    ),
    fitAxis: 'y',
    clearanceMm: 0,
    profileToleranceMm: positive(settings.profileToleranceMm, 'Profile tolerance'),
    sizeMode: 'custom',
    envelopeDimensions: {
      widthMm: positive(settings.widthMm, 'Template width'),
      lengthMm: positive(settings.lengthMm, 'Template length'),
      heightMm: positive(settings.heightMm, 'Template height'),
    },
    parameters: {
      wallHeightMm: positive(settings.wallHeightMm, 'Wall height'),
      tabDepthMm: positive(settings.tabDepthMm, 'Tab depth'),
      lidDepthMm: positive(settings.lidDepthMm, 'Lid depth'),
      lidClearanceMm: nonNegative(settings.lidClearanceMm, 'Lid clearance'),
      gussetDepthMm: positive(settings.gussetDepthMm, 'Gusset depth'),
      closureFlapMm: nonNegative(settings.closureFlapMm, 'Closure flap'),
      prismSides: integer(settings.prismSides, 'Prism sides', 3),
      prismRotationDeg: finite(settings.prismRotationDeg, 'Prism rotation'),
      topScale: nonNegative(settings.topScale, 'Top scale'),
      seamTabMm: positive(settings.seamTabMm, 'Seam tab'),
      standalone: true,
      closureMethod: enumValue(settings.closureMethod, ['glue', 'press-fit'], 'Closure method'),
      slotClearanceMm: nonNegative(settings.slotClearanceMm, 'Slot clearance'),
    },
    connectionOverrides: activeOverrides,
    boundaryGlueTabs: activeBoundaryTabs,
    glueTabDepthMm: positive(settings.glueTabDepthMm, 'Manual glue tab depth'),
  };
}

function unfoldSettings(project: ProjectData): MeshUnfoldSettings {
  const settings = project.modeSettings.meshUnfold;
  return {
    strategy: enumValue(settings.strategy, ['automatic', 'manual'], 'Unfold strategy'),
    rootFaceIndex: integer(settings.rootFaceIndex, 'Root face', 0),
    manualSeamKeys: [...new Set(settings.manualSeamKeys)].sort(),
    tabDepthMm: positive(settings.tabDepthMm, 'Unfold tab depth'),
    maximumFaceCount: integer(settings.maximumFaceCount, 'Maximum face count', 1),
    searchAttempts: integer(settings.searchAttempts, 'Search attempts', 1),
  };
}

function panelFeature(feature: PanelFeature): PanelFeature {
  if (typeof feature.id !== 'string' || !feature.id.trim()) {
    throw new GenerationInputError('Panel feature ID is invalid.');
  }
  const targetRole = enumValue(
    feature.targetRole,
    ['base', 'front', 'back', 'left', 'right', 'lid'],
    'Panel feature target',
  );
  const common = {
    id: feature.id,
    targetRole,
    anchor: {
      u: finite(feature.anchor.u, 'Panel feature horizontal anchor'),
      v: finite(feature.anchor.v, 'Panel feature vertical anchor'),
    },
    ...(feature.offsetMm
      ? {
          offsetMm: {
            x: finite(feature.offsetMm.x, 'Panel feature horizontal offset'),
            y: finite(feature.offsetMm.y, 'Panel feature vertical offset'),
          },
        }
      : {}),
    rotationDeg: finite(feature.rotationDeg, 'Panel feature rotation'),
    ...(feature.purpose !== undefined ? { purpose: feature.purpose } : {}),
  };
  if (feature.kind === 'rectangular-cutout') {
    return {
      ...common,
      kind: feature.kind,
      widthMm: finite(feature.widthMm, 'Rectangular cutout width'),
      heightMm: finite(feature.heightMm, 'Rectangular cutout height'),
    };
  }
  if (feature.kind === 'circular-cutout') {
    return {
      ...common,
      kind: feature.kind,
      diameterMm: finite(feature.diameterMm, 'Circular cutout diameter'),
    };
  }
  if (feature.kind === 'engraved-label') {
    return {
      ...common,
      kind: feature.kind,
      text: feature.text,
      fontSizeMm: finite(feature.fontSizeMm, 'Engraved label size'),
    };
  }
  throw new GenerationInputError('Panel feature kind is invalid.');
}

function panelSettings(project: ProjectData): PanelGenerationSettings {
  const settings = project.modeSettings.panelConstruction;
  const features = settings.features.map(panelFeature);
  if (new Set(features.map((feature) => feature.id)).size !== features.length) {
    throw new GenerationInputError('Panel feature IDs must be unique.');
  }
  const panelThicknessMm = positive(settings.panelThicknessMm, 'Panel material thickness');
  const dividerThicknessMm = positive(settings.dividerThicknessMm, 'Divider material thickness');
  const lidThicknessMm = positive(settings.lidThicknessMm, 'Lid material thickness');
  const widthDividerCount = integer(settings.widthDividerCount, 'Width divider count', 0);
  const depthDividerCount = integer(settings.depthDividerCount, 'Depth divider count', 0);
  if (
    widthDividerCount > maximumPanelDividerCount(settings.innerDepthMm, dividerThicknessMm) ||
    depthDividerCount > maximumPanelDividerCount(settings.innerWidthMm, dividerThicknessMm)
  ) {
    throw new GenerationInputError('Divider count exceeds the available panel space.');
  }
  const overrides = settings.connectionOverrides ?? {};
  const unknownConnection = Object.keys(overrides).find(
    (key) => !PANEL_CONNECTION_KEYS.includes(key as (typeof PANEL_CONNECTION_KEYS)[number]),
  );
  if (unknownConnection) throw new GenerationInputError('Panel connection key is invalid.');
  const connectionOverrides: PanelConnectionOverrides = {};
  for (const key of PANEL_CONNECTION_KEYS) {
    const override = overrides[key];
    if (!override) continue;
    const treatment = enumValue<PanelConnectionTreatment>(
      override.treatment,
      ['butt', 'finger', 'crease'],
      `${key} connection treatment`,
    );
    connectionOverrides[key] = {
      treatment,
      ...(override.clearanceMm === undefined
        ? {}
        : { clearanceMm: nonNegative(override.clearanceMm, `${key} clearance`) }),
      ...(override.glueTabOwnerPanelId
        ? {
            glueTabOwnerPanelId: nonEmpty(
              override.glueTabOwnerPanelId,
              `${key} glue-tab owner panel ID`,
            ),
          }
        : {}),
    };
  }
  const sourceProfiles = settings.panelProfiles ?? DEFAULT_PANEL_PROFILES;
  const panelProfiles: PanelProfiles = {
    front: enumValue(sourceProfiles.front, PANEL_PROFILE_KINDS, 'Front panel profile'),
    back: enumValue(sourceProfiles.back, PANEL_PROFILE_KINDS, 'Back panel profile'),
  };
  const boundaryGlueTabs = settings.boundaryGlueTabs
    .map((tab) => ({
      id: nonEmpty(tab.id, 'Panel boundary tab ID'),
      edgeId: nonEmpty(tab.edgeId, 'Panel boundary edge ID'),
      ownerPanelId: nonEmpty(tab.ownerPanelId, 'Panel boundary owner panel ID'),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  if (new Set(boundaryGlueTabs.map((tab) => tab.id)).size !== boundaryGlueTabs.length) {
    throw new GenerationInputError('Panel boundary tab IDs must be unique.');
  }
  return {
    innerWidthMm: positive(settings.innerWidthMm, 'Panel inside width'),
    innerDepthMm: positive(settings.innerDepthMm, 'Panel inside depth'),
    innerHeightMm: positive(settings.innerHeightMm, 'Panel inside height'),
    jointKind: enumValue<CurrentPanelJointKind>(
      settings.jointKind,
      ['butt', 'finger'],
      'Panel joint kind',
    ),
    fingerWidthMm: positive(settings.fingerWidthMm, 'Panel finger width'),
    clearanceMm: nonNegative(settings.clearanceMm, 'Panel clearance'),
    includeLid: settings.includeLid,
    panelThicknessMm,
    dividerThicknessMm,
    lidThicknessMm,
    widthDividerCount,
    depthDividerCount,
    connectionOverrides,
    panelProfiles,
    glueTabDepthMm: positive(settings.glueTabDepthMm, 'Panel glue tab depth'),
    boundaryGlueTabs,
    features: features.sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function panelMaterial(project: ProjectData, panelThicknessMm: number): PanelConstructionMaterial {
  const material = project.materialProfileSnapshot;
  return {
    id: material.id,
    category: material.category,
    thicknessMm: panelThicknessMm,
    kerfMm: nonNegative(material.kerfMm, 'Material kerf'),
  };
}

export function buildCanonicalGenerationInput(project: ProjectData): CanonicalGenerationInput {
  switch (project.fabricationMode) {
    case 'stacked-slices':
      return {
        mode: project.fabricationMode,
        payload: { ...requireModel(project), settings: stackedSettings(project) },
      };
    case 'waffle-slices':
      return {
        mode: project.fabricationMode,
        payload: { ...requireModel(project), settings: waffleSettings(project) },
      };
    case 'fold-template':
      return {
        mode: project.fabricationMode,
        payload: {
          materialThicknessMm: positive(
            project.materialProfileSnapshot.thicknessMm,
            'Material thickness',
          ),
          settings: foldSettings(project),
        },
      };
    case 'mesh-unfold': {
      const { mesh, modelId } = requireModel(project);
      return {
        mode: project.fabricationMode,
        payload: {
          mesh,
          modelId,
          materialThicknessMm: positive(
            project.materialProfileSnapshot.thicknessMm,
            'Material thickness',
          ),
          settings: unfoldSettings(project),
        },
      };
    }
    case 'panel-construction': {
      const settings = panelSettings(project);
      return {
        mode: project.fabricationMode,
        payload: {
          sourceId: PANEL_CONSTRUCTION_SOURCE_ID,
          material: panelMaterial(project, settings.panelThicknessMm),
          settings,
        },
      };
    }
  }
}

export function canonicalGenerationInputHash(input: CanonicalGenerationInput): string {
  return hashSerializable(input);
}

export function canonicalGenerationSignature(project: ProjectData): {
  signatureVersion: 2;
  mode: FabricationMode;
  inputHash: string;
} {
  const input = buildCanonicalGenerationInput(project);
  return { signatureVersion: 2, mode: input.mode, inputHash: canonicalGenerationInputHash(input) };
}

export function generationInputChanged(before: ProjectData, after: ProjectData): boolean {
  try {
    return (
      canonicalGenerationSignature(before).inputHash !==
      canonicalGenerationSignature(after).inputHash
    );
  } catch {
    return true;
  }
}
