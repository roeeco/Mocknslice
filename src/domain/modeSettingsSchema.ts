import {
  array,
  boolean,
  check,
  finite,
  literal,
  number,
  optional,
  picklist,
  pipe,
  strictObject,
  string,
  variant,
} from 'valibot';
import { CLASSROOM_RECIPE_IDS } from './classroomRecipes';

const finiteNumber = pipe(number(), finite());
const axis = picklist(['x', 'y', 'z']);
const templateKind = picklist([
  'open-box',
  'box-with-lid',
  'tray',
  'sleeve',
  'envelope',
  'regular-prism',
  'pyramid-frustum',
]);
const targetRole = picklist(['base', 'front', 'back', 'left', 'right', 'lid']);
const anchor = strictObject({ u: finiteNumber, v: finiteNumber });
const offset = strictObject({ x: finiteNumber, y: finiteNumber });
const featureCommon = {
  id: string(),
  targetRole,
  anchor,
  offsetMm: optional(offset),
  rotationDeg: finiteNumber,
  purpose: optional(string()),
};
const connectionOverride = strictObject({
  treatment: picklist(['butt', 'finger', 'crease']),
  clearanceMm: optional(finiteNumber),
  glueTabOwnerPanelId: optional(string()),
});
const foldingConnectionOverride = strictObject({
  id: string(),
  templateKind,
  connectionId: string(),
  treatment: picklist(['crease', 'cut']),
  closure: picklist(['none', 'glue-tab', 'press-fit']),
  tabOwnerPanelId: optional(string()),
});
const boundaryGlueTab = strictObject({
  id: string(),
  templateKind,
  edgeId: string(),
  ownerPanelId: string(),
});

export const panelFeatureSchema = variant('kind', [
  strictObject({
    ...featureCommon,
    kind: literal('rectangular-cutout'),
    widthMm: finiteNumber,
    heightMm: finiteNumber,
  }),
  strictObject({
    ...featureCommon,
    kind: literal('circular-cutout'),
    diameterMm: finiteNumber,
  }),
  strictObject({
    ...featureCommon,
    kind: literal('engraved-label'),
    text: string(),
    fontSizeMm: finiteNumber,
  }),
]);

export const modeSettingsSchema = strictObject({
  stackedSlices: strictObject({
    axis,
    spacingMm: finiteNumber,
    thicknessMm: finiteNumber,
    contourEpsilonMm: finiteNumber,
  }),
  waffleSlices: strictObject({
    primaryAxis: axis,
    secondaryAxis: axis,
    primarySpacingMm: finiteNumber,
    secondarySpacingMm: finiteNumber,
    thicknessMm: finiteNumber,
    clearanceMm: finiteNumber,
    contourEpsilonMm: finiteNumber,
    slotPattern: picklist(['by-family', 'alternating']),
    reverseSlots: boolean(),
  }),
  foldTemplate: strictObject({
    templateKind,
    widthMm: finiteNumber,
    lengthMm: finiteNumber,
    heightMm: finiteNumber,
    profileToleranceMm: finiteNumber,
    wallHeightMm: finiteNumber,
    tabDepthMm: finiteNumber,
    lidDepthMm: finiteNumber,
    lidClearanceMm: finiteNumber,
    gussetDepthMm: finiteNumber,
    closureFlapMm: finiteNumber,
    prismSides: finiteNumber,
    prismRotationDeg: finiteNumber,
    topScale: finiteNumber,
    seamTabMm: finiteNumber,
    closureMethod: picklist(['glue', 'press-fit']),
    slotClearanceMm: finiteNumber,
    connectionOverrides: array(foldingConnectionOverride),
    boundaryGlueTabs: array(boundaryGlueTab),
    glueTabDepthMm: finiteNumber,
  }),
  meshUnfold: strictObject({
    strategy: picklist(['automatic', 'manual']),
    rootFaceIndex: finiteNumber,
    manualSeamKeys: array(string()),
    tabDepthMm: finiteNumber,
    maximumFaceCount: finiteNumber,
    searchAttempts: finiteNumber,
  }),
  panelConstruction: strictObject({
    innerWidthMm: finiteNumber,
    innerDepthMm: finiteNumber,
    innerHeightMm: finiteNumber,
    jointKind: picklist(['butt', 'finger', 'tab-slot']),
    fingerWidthMm: finiteNumber,
    clearanceMm: finiteNumber,
    includeLid: boolean(),
    panelThicknessMm: optional(finiteNumber),
    dividerThicknessMm: optional(finiteNumber),
    lidThicknessMm: optional(finiteNumber),
    widthDividerCount: finiteNumber,
    depthDividerCount: finiteNumber,
    connectionOverrides: strictObject({
      'base-front': optional(connectionOverride),
      'base-back': optional(connectionOverride),
      'base-left': optional(connectionOverride),
      'base-right': optional(connectionOverride),
      'front-left': optional(connectionOverride),
      'front-right': optional(connectionOverride),
      'back-left': optional(connectionOverride),
      'back-right': optional(connectionOverride),
      'lid-front': optional(connectionOverride),
      'lid-back': optional(connectionOverride),
      'lid-left': optional(connectionOverride),
      'lid-right': optional(connectionOverride),
    }),
    glueTabDepthMm: finiteNumber,
    boundaryGlueTabs: array(
      strictObject({
        id: string(),
        ownerPanelId: string(),
        edgeId: string(),
      }),
    ),
    panelProfiles: optional(
      strictObject({
        front: picklist(['flat', 'arch', 'gable', 'stepped']),
        back: picklist(['flat', 'arch', 'gable', 'stepped']),
      }),
    ),
    recipe: optional(
      strictObject({
        id: picklist(CLASSROOM_RECIPE_IDS),
        revision: finiteNumber,
      }),
    ),
    features: pipe(
      array(panelFeatureSchema),
      check(
        (features) => new Set(features.map((feature) => feature.id)).size === features.length,
        'Panel feature IDs must be unique.',
      ),
    ),
  }),
});
