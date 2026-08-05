import type { Dimensions3D, Millimetres } from './geometry';
import type { MaterialProfile } from './material';
import type { FoldClosureMethod, TemplateKind } from './folding';
import type {
  CurrentPanelJointKind,
  PanelBoundaryGlueTab,
  PanelConnectionOverrides,
  PanelConstructionSettings,
  PanelProfiles,
  PanelRole,
} from './panelConstruction';
import { clampPanelThickness, DEFAULT_PANEL_PROFILES } from './panelConstruction';
import type { StackedSliceSettings, WaffleSliceSettings } from './slicing';
import type { MeshUnfoldSettings } from './unfolding';
import type { ClassroomRecipeId } from './classroomRecipes';
import type { BoundaryGlueTab, FoldingConnectionOverride } from './connections';
import { clampGlueTabDepthMm } from './connections';

export interface FoldTemplateSettings {
  templateKind: TemplateKind;
  widthMm: Millimetres;
  lengthMm: Millimetres;
  heightMm: Millimetres;
  profileToleranceMm: Millimetres;
  wallHeightMm: Millimetres;
  tabDepthMm: Millimetres;
  lidDepthMm: Millimetres;
  lidClearanceMm: Millimetres;
  gussetDepthMm: Millimetres;
  closureFlapMm: Millimetres;
  prismSides: number;
  prismRotationDeg: number;
  topScale: number;
  seamTabMm: Millimetres;
  closureMethod: FoldClosureMethod;
  slotClearanceMm: Millimetres;
  connectionOverrides: FoldingConnectionOverride[];
  boundaryGlueTabs: BoundaryGlueTab[];
  glueTabDepthMm: Millimetres;
}

export type PanelFeatureTargetRole = Exclude<PanelRole, `divider-${number}`>;

export interface PanelFeatureCommon {
  id: string;
  targetRole: PanelFeatureTargetRole;
  /** Panel-local anchor: left-to-right and bottom-to-top. */
  anchor: { u: number; v: number };
  offsetMm?: { x: Millimetres; y: Millimetres };
  /** Counter-clockwise rotation in panel-local coordinates. */
  rotationDeg: number;
  purpose?: string;
}

export interface RectangularCutoutFeature extends PanelFeatureCommon {
  kind: 'rectangular-cutout';
  widthMm: Millimetres;
  heightMm: Millimetres;
}

export interface CircularCutoutFeature extends PanelFeatureCommon {
  kind: 'circular-cutout';
  diameterMm: Millimetres;
}

export interface EngravedLabelFeature extends PanelFeatureCommon {
  kind: 'engraved-label';
  text: string;
  fontSizeMm: Millimetres;
}

export type PanelFeature = RectangularCutoutFeature | CircularCutoutFeature | EngravedLabelFeature;

export interface PanelRecipeProvenance {
  id: ClassroomRecipeId;
  revision: number;
}

export interface PanelComposerSettings extends Omit<
  PanelConstructionSettings,
  'jointKind' | 'panelThicknessMm' | 'dividerThicknessMm' | 'lidThicknessMm'
> {
  jointKind: CurrentPanelJointKind;
  panelThicknessMm: Millimetres;
  dividerThicknessMm: Millimetres;
  lidThicknessMm: Millimetres;
  widthDividerCount: number;
  depthDividerCount: number;
  connectionOverrides: PanelConnectionOverrides;
  panelProfiles: PanelProfiles;
  glueTabDepthMm: Millimetres;
  boundaryGlueTabs: PanelBoundaryGlueTab[];
  recipe?: PanelRecipeProvenance;
  features: PanelFeature[];
}

export interface ModeSettingsByMode {
  stackedSlices: StackedSliceSettings;
  waffleSlices: WaffleSliceSettings;
  foldTemplate: FoldTemplateSettings;
  meshUnfold: MeshUnfoldSettings;
  panelConstruction: PanelComposerSettings;
}

type CompatiblePanelComposerSettings = PanelConstructionSettings &
  Partial<
    Pick<
      PanelComposerSettings,
      | 'panelThicknessMm'
      | 'dividerThicknessMm'
      | 'lidThicknessMm'
      | 'recipe'
      | 'features'
      | 'connectionOverrides'
      | 'panelProfiles'
      | 'glueTabDepthMm'
      | 'boundaryGlueTabs'
    >
  >;

export function normalizePanelComposerSettings(
  settings: CompatiblePanelComposerSettings,
  material: Pick<MaterialProfile, 'thicknessMm'>,
): PanelComposerSettings {
  const panelThicknessMm = clampPanelThickness(settings.panelThicknessMm ?? material.thicknessMm);
  return {
    ...settings,
    jointKind: settings.jointKind === 'tab-slot' ? 'finger' : settings.jointKind,
    panelThicknessMm,
    dividerThicknessMm: clampPanelThickness(settings.dividerThicknessMm ?? panelThicknessMm),
    lidThicknessMm: clampPanelThickness(settings.lidThicknessMm ?? panelThicknessMm),
    widthDividerCount: Math.max(0, Math.round(settings.widthDividerCount ?? 0)),
    depthDividerCount: Math.max(0, Math.round(settings.depthDividerCount ?? 0)),
    connectionOverrides: structuredClone(settings.connectionOverrides ?? {}),
    panelProfiles: structuredClone(settings.panelProfiles ?? DEFAULT_PANEL_PROFILES),
    glueTabDepthMm: clampGlueTabDepthMm(settings.glueTabDepthMm ?? 8),
    boundaryGlueTabs: structuredClone(settings.boundaryGlueTabs ?? []),
    features: settings.features ? structuredClone(settings.features) : [],
  };
}

export type LegacyModeParameters = Record<string, number | string | boolean>;

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stringValue<T extends string>(value: unknown, values: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value === 'string' && values.includes(value as T)) return value as T;
  throw new Error('A legacy settings discriminator is invalid.');
}

export function createDefaultModeSettings(
  material: MaterialProfile,
  dimensions: Dimensions3D,
): ModeSettingsByMode {
  return {
    stackedSlices: {
      axis: 'z',
      spacingMm: 10,
      thicknessMm: material.thicknessMm,
      contourEpsilonMm: 0.001,
    },
    waffleSlices: {
      primaryAxis: 'x',
      secondaryAxis: 'y',
      primarySpacingMm: 20,
      secondarySpacingMm: 20,
      thicknessMm: material.thicknessMm,
      clearanceMm: material.clearanceMm,
      contourEpsilonMm: 0.001,
      slotPattern: 'alternating',
      reverseSlots: false,
    },
    foldTemplate: {
      templateKind: 'open-box',
      widthMm: dimensions.widthMm,
      lengthMm: dimensions.depthMm,
      heightMm: dimensions.heightMm,
      profileToleranceMm: 1,
      wallHeightMm: dimensions.depthMm,
      tabDepthMm: 8,
      lidDepthMm: 15,
      lidClearanceMm: 0.5,
      gussetDepthMm: dimensions.depthMm,
      closureFlapMm: 12,
      prismSides: 6,
      prismRotationDeg: 0,
      topScale: 0,
      seamTabMm: 8,
      closureMethod: 'glue',
      slotClearanceMm: material.clearanceMm,
      connectionOverrides: [],
      boundaryGlueTabs: [],
      glueTabDepthMm: 8,
    },
    meshUnfold: {
      strategy: 'automatic',
      rootFaceIndex: 0,
      manualSeamKeys: [],
      tabDepthMm: 6,
      maximumFaceCount: 200,
      searchAttempts: 18,
    },
    panelConstruction: {
      innerWidthMm: 80,
      innerDepthMm: 60,
      innerHeightMm: 50,
      jointKind: 'finger',
      fingerWidthMm: 10,
      clearanceMm: material.clearanceMm,
      includeLid: false,
      panelThicknessMm: clampPanelThickness(material.thicknessMm),
      dividerThicknessMm: clampPanelThickness(material.thicknessMm),
      lidThicknessMm: clampPanelThickness(material.thicknessMm),
      widthDividerCount: 0,
      depthDividerCount: 0,
      connectionOverrides: {},
      panelProfiles: structuredClone(DEFAULT_PANEL_PROFILES),
      glueTabDepthMm: 8,
      boundaryGlueTabs: [],
      features: [],
    },
  };
}

/** Overlay the fields known to project formats 1–6 onto complete current defaults. */
export function migrateLegacyModeParameters(
  parameters: LegacyModeParameters,
  material: MaterialProfile,
  dimensions: Dimensions3D,
): ModeSettingsByMode {
  const defaults = createDefaultModeSettings(material, dimensions);
  const legacyDividerCount = Math.max(0, Math.round(finiteNumber(parameters.panelDividerCount, 0)));
  const hasGridCounts =
    parameters.panelWidthDividerCount !== undefined ||
    parameters.panelDepthDividerCount !== undefined;
  const seams = typeof parameters.meshUnfoldSeams === 'string' ? parameters.meshUnfoldSeams : '';
  return {
    stackedSlices: {
      axis: stringValue(parameters.sliceAxis, ['x', 'y', 'z'], defaults.stackedSlices.axis),
      spacingMm: finiteNumber(parameters.spacingMm, defaults.stackedSlices.spacingMm),
      thicknessMm: finiteNumber(parameters.sliceThicknessMm, defaults.stackedSlices.thicknessMm),
      contourEpsilonMm: finiteNumber(
        parameters.contourEpsilonMm,
        defaults.stackedSlices.contourEpsilonMm,
      ),
    },
    waffleSlices: {
      primaryAxis: stringValue(
        parameters.wafflePrimaryAxis,
        ['x', 'y', 'z'],
        defaults.waffleSlices.primaryAxis,
      ),
      secondaryAxis: stringValue(
        parameters.waffleSecondaryAxis,
        ['x', 'y', 'z'],
        defaults.waffleSlices.secondaryAxis,
      ),
      primarySpacingMm: finiteNumber(
        parameters.wafflePrimarySpacingMm,
        defaults.waffleSlices.primarySpacingMm,
      ),
      secondarySpacingMm: finiteNumber(
        parameters.waffleSecondarySpacingMm,
        defaults.waffleSlices.secondarySpacingMm,
      ),
      thicknessMm: finiteNumber(parameters.waffleThicknessMm, defaults.waffleSlices.thicknessMm),
      clearanceMm: finiteNumber(parameters.waffleClearanceMm, defaults.waffleSlices.clearanceMm),
      contourEpsilonMm: finiteNumber(
        parameters.contourEpsilonMm,
        defaults.waffleSlices.contourEpsilonMm,
      ),
      slotPattern: stringValue(
        parameters.waffleSlotPattern,
        ['by-family', 'alternating'],
        defaults.waffleSlices.slotPattern,
      ),
      reverseSlots:
        typeof parameters.waffleReverseSlots === 'boolean'
          ? parameters.waffleReverseSlots
          : defaults.waffleSlices.reverseSlots,
    },
    foldTemplate: {
      templateKind: stringValue(
        parameters.foldTemplateKind,
        [
          'open-box',
          'box-with-lid',
          'tray',
          'sleeve',
          'envelope',
          'regular-prism',
          'pyramid-frustum',
        ],
        defaults.foldTemplate.templateKind,
      ),
      widthMm: finiteNumber(parameters.foldWidthMm, defaults.foldTemplate.widthMm),
      lengthMm: finiteNumber(parameters.foldLengthMm, defaults.foldTemplate.lengthMm),
      heightMm: finiteNumber(parameters.foldHeightMm, defaults.foldTemplate.heightMm),
      profileToleranceMm: finiteNumber(
        parameters.foldProfileToleranceMm,
        defaults.foldTemplate.profileToleranceMm,
      ),
      wallHeightMm: finiteNumber(parameters.foldWallHeightMm, defaults.foldTemplate.wallHeightMm),
      tabDepthMm: finiteNumber(parameters.foldTabDepthMm, defaults.foldTemplate.tabDepthMm),
      lidDepthMm: finiteNumber(parameters.foldLidDepthMm, defaults.foldTemplate.lidDepthMm),
      lidClearanceMm: finiteNumber(
        parameters.foldLidClearanceMm,
        defaults.foldTemplate.lidClearanceMm,
      ),
      gussetDepthMm: finiteNumber(
        parameters.foldGussetDepthMm,
        defaults.foldTemplate.gussetDepthMm,
      ),
      closureFlapMm: finiteNumber(
        parameters.foldClosureFlapMm,
        defaults.foldTemplate.closureFlapMm,
      ),
      prismSides: finiteNumber(parameters.foldPrismSides, defaults.foldTemplate.prismSides),
      prismRotationDeg: finiteNumber(
        parameters.foldPrismRotationDeg,
        defaults.foldTemplate.prismRotationDeg,
      ),
      topScale: finiteNumber(parameters.foldTopScale, defaults.foldTemplate.topScale),
      seamTabMm: finiteNumber(parameters.foldSeamTabMm, defaults.foldTemplate.seamTabMm),
      closureMethod: stringValue(
        parameters.foldClosureMethod,
        ['glue', 'press-fit'],
        defaults.foldTemplate.closureMethod,
      ),
      slotClearanceMm: finiteNumber(
        parameters.foldSlotClearanceMm,
        defaults.foldTemplate.slotClearanceMm,
      ),
      connectionOverrides: [],
      boundaryGlueTabs: [],
      glueTabDepthMm: 8,
    },
    meshUnfold: {
      strategy: stringValue(
        parameters.meshUnfoldStrategy,
        ['automatic', 'manual'],
        defaults.meshUnfold.strategy,
      ),
      rootFaceIndex: finiteNumber(parameters.meshUnfoldRootFace, defaults.meshUnfold.rootFaceIndex),
      manualSeamKeys: [
        ...new Set(
          seams
            .split(',')
            .map((key) => key.trim())
            .filter(Boolean),
        ),
      ].sort(),
      tabDepthMm: finiteNumber(parameters.meshUnfoldTabDepthMm, defaults.meshUnfold.tabDepthMm),
      maximumFaceCount: finiteNumber(
        parameters.meshUnfoldMaximumFaces,
        defaults.meshUnfold.maximumFaceCount,
      ),
      searchAttempts: finiteNumber(
        parameters.meshUnfoldSearchAttempts,
        defaults.meshUnfold.searchAttempts,
      ),
    },
    panelConstruction: {
      innerWidthMm: finiteNumber(
        parameters.panelInnerWidthMm,
        defaults.panelConstruction.innerWidthMm,
      ),
      innerDepthMm: finiteNumber(
        parameters.panelInnerDepthMm,
        defaults.panelConstruction.innerDepthMm,
      ),
      innerHeightMm: finiteNumber(
        parameters.panelInnerHeightMm,
        defaults.panelConstruction.innerHeightMm,
      ),
      jointKind:
        stringValue(
          parameters.panelJointKind,
          ['butt', 'finger', 'tab-slot'],
          defaults.panelConstruction.jointKind,
        ) === 'tab-slot'
          ? 'finger'
          : ((parameters.panelJointKind as 'butt' | 'finger' | undefined) ??
            defaults.panelConstruction.jointKind),
      fingerWidthMm: finiteNumber(
        parameters.panelFingerWidthMm,
        defaults.panelConstruction.fingerWidthMm,
      ),
      clearanceMm: finiteNumber(
        parameters.panelClearanceMm,
        defaults.panelConstruction.clearanceMm,
      ),
      includeLid:
        typeof parameters.panelIncludeLid === 'boolean'
          ? parameters.panelIncludeLid
          : defaults.panelConstruction.includeLid,
      panelThicknessMm: clampPanelThickness(
        finiteNumber(parameters.panelThicknessMm, material.thicknessMm),
      ),
      dividerThicknessMm: clampPanelThickness(
        finiteNumber(parameters.panelDividerThicknessMm, material.thicknessMm),
      ),
      lidThicknessMm: clampPanelThickness(
        finiteNumber(parameters.panelLidThicknessMm, material.thicknessMm),
      ),
      widthDividerCount: finiteNumber(
        parameters.panelWidthDividerCount,
        hasGridCounts || parameters.panelDividerAxis === 'depth' ? 0 : legacyDividerCount,
      ),
      depthDividerCount: finiteNumber(
        parameters.panelDepthDividerCount,
        hasGridCounts || parameters.panelDividerAxis !== 'depth' ? 0 : legacyDividerCount,
      ),
      connectionOverrides: {},
      panelProfiles: structuredClone(DEFAULT_PANEL_PROFILES),
      glueTabDepthMm: 8,
      boundaryGlueTabs: [],
      features: [],
    },
  };
}
