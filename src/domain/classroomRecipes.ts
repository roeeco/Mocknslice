import type { MaterialCategory, MaterialProfile } from './material';
import type { PanelComposerSettings, PanelFeature } from './modeSettings';
import type { ValidationIssue } from './validation';
import { hashSerializable } from './canonicalHash';

export const CLASSROOM_RECIPE_IDS = [
  'survey-ballot-box',
  'sorting-tray',
  'flash-card-holder',
  'game-component-box',
  'blank-panel-box',
] as const;

export type ClassroomRecipeId = (typeof CLASSROOM_RECIPE_IDS)[number];
export type ClassroomRecipeTag = 'civics' | 'sorting' | 'study' | 'games' | 'open-ended';
export type ClassroomDimensionPrompt = 'innerWidthMm' | 'innerDepthMm' | 'innerHeightMm';

export interface LocalizedRecipeText {
  en: string;
  he: string;
}

export interface ClassroomRecipeDefinition {
  id: ClassroomRecipeId;
  revision: number;
  title: LocalizedRecipeText;
  description: LocalizedRecipeText;
  tags: readonly ClassroomRecipeTag[];
  recommendedMaterialCategories: readonly MaterialCategory[];
  essentialDimensionPrompts: readonly ClassroomDimensionPrompt[];
  caution?: LocalizedRecipeText;
  settingsFactory: (
    material: Pick<MaterialProfile, 'clearanceMm' | 'thicknessMm'>,
  ) => PanelComposerSettings;
}

const ALL_MATERIAL_CATEGORIES: readonly MaterialCategory[] = [
  'paper',
  'card',
  'corrugated-cardboard',
  'sheet-wood',
  'plastic',
  'custom',
];

function settings(
  id: ClassroomRecipeId,
  material: Pick<MaterialProfile, 'clearanceMm' | 'thicknessMm'>,
  values: Omit<
    PanelComposerSettings,
    | 'clearanceMm'
    | 'panelThicknessMm'
    | 'dividerThicknessMm'
    | 'lidThicknessMm'
    | 'connectionOverrides'
    | 'panelProfiles'
    | 'glueTabDepthMm'
    | 'boundaryGlueTabs'
    | 'recipe'
  >,
): PanelComposerSettings {
  const thicknessMm = Math.min(10, Math.max(1, material.thicknessMm));
  return {
    ...values,
    clearanceMm: material.clearanceMm,
    panelThicknessMm: thicknessMm,
    dividerThicknessMm: thicknessMm,
    lidThicknessMm: thicknessMm,
    connectionOverrides: {},
    panelProfiles: { front: 'flat', back: 'flat' },
    glueTabDepthMm: 8,
    boundaryGlueTabs: [],
    recipe: { id, revision: 1 },
  };
}

export const CLASSROOM_RECIPES: readonly ClassroomRecipeDefinition[] = [
  {
    id: 'survey-ballot-box',
    revision: 1,
    title: { en: 'Survey / ballot box', he: 'תיבת סקר / הצבעה' },
    description: {
      en: 'A lidded collection box with a response slot.',
      he: 'תיבת איסוף עם מכסה וחריץ לתשובות.',
    },
    tags: ['civics'],
    recommendedMaterialCategories: ['card', 'corrugated-cardboard', 'sheet-wood'],
    essentialDimensionPrompts: ['innerWidthMm', 'innerDepthMm', 'innerHeightMm'],
    settingsFactory: (material) =>
      settings('survey-ballot-box', material, {
        innerWidthMm: 160,
        innerDepthMm: 120,
        innerHeightMm: 180,
        jointKind: 'finger',
        fingerWidthMm: 12,
        includeLid: true,
        widthDividerCount: 0,
        depthDividerCount: 0,
        features: [
          {
            id: 'survey-response-slot',
            kind: 'rectangular-cutout',
            targetRole: 'lid',
            anchor: { u: 0.5, v: 0.5 },
            rotationDeg: 0,
            widthMm: 90,
            heightMm: 12,
            purpose: 'Response slot',
          },
        ],
      }),
  },
  {
    id: 'sorting-tray',
    revision: 1,
    title: { en: 'Sorting tray', he: 'מגש מיון' },
    description: {
      en: 'An open tray with four sections for sorting classroom materials.',
      he: 'מגש פתוח עם ארבעה תאים למיון חומרי לימוד.',
    },
    tags: ['sorting'],
    recommendedMaterialCategories: ['card', 'corrugated-cardboard', 'sheet-wood', 'plastic'],
    essentialDimensionPrompts: ['innerWidthMm', 'innerDepthMm', 'innerHeightMm'],
    settingsFactory: (material) =>
      settings('sorting-tray', material, {
        innerWidthMm: 240,
        innerDepthMm: 160,
        innerHeightMm: 45,
        jointKind: 'finger',
        fingerWidthMm: 14,
        includeLid: false,
        widthDividerCount: 3,
        depthDividerCount: 0,
        features: [],
      }),
  },
  {
    id: 'flash-card-holder',
    revision: 1,
    title: { en: 'Flash-card holder', he: 'מעמד לכרטיסיות' },
    description: {
      en: 'A compact holder with a front access notch for study cards.',
      he: 'מעמד קומפקטי עם פתח קדמי לגישה לכרטיסיות לימוד.',
    },
    tags: ['study'],
    recommendedMaterialCategories: ['card', 'sheet-wood', 'plastic'],
    essentialDimensionPrompts: ['innerWidthMm', 'innerDepthMm', 'innerHeightMm'],
    settingsFactory: (material) =>
      settings('flash-card-holder', material, {
        innerWidthMm: 110,
        innerDepthMm: 75,
        innerHeightMm: 80,
        jointKind: 'finger',
        fingerWidthMm: 10,
        includeLid: false,
        widthDividerCount: 0,
        depthDividerCount: 0,
        features: [
          {
            id: 'flash-card-access-notch',
            kind: 'circular-cutout',
            targetRole: 'front',
            anchor: { u: 0.5, v: 0.75 },
            offsetMm: { x: 0, y: -8 },
            rotationDeg: 0,
            diameterMm: 44,
            purpose: 'Card access notch',
          },
        ],
      }),
  },
  {
    id: 'game-component-box',
    revision: 1,
    title: { en: 'Game-component box', he: 'קופסה לחלקי משחק' },
    description: {
      en: 'A divided lidded box for tokens, dice, cards, and small pieces.',
      he: 'קופסה מחולקת עם מכסה לאסימונים, קוביות, קלפים וחלקים קטנים.',
    },
    tags: ['games', 'sorting'],
    recommendedMaterialCategories: ['corrugated-cardboard', 'sheet-wood', 'plastic'],
    essentialDimensionPrompts: ['innerWidthMm', 'innerDepthMm', 'innerHeightMm'],
    settingsFactory: (material) =>
      settings('game-component-box', material, {
        innerWidthMm: 180,
        innerDepthMm: 120,
        innerHeightMm: 55,
        jointKind: 'finger',
        fingerWidthMm: 10,
        includeLid: true,
        widthDividerCount: 2,
        depthDividerCount: 1,
        features: [],
      }),
  },
  {
    id: 'blank-panel-box',
    revision: 1,
    title: { en: 'Blank panel box', he: 'קופסת לוחות ריקה' },
    description: {
      en: 'Start from a plain enclosure and configure every panel setting yourself.',
      he: 'התחלה ממארז פשוט והגדרה עצמאית של כל הגדרות הלוחות.',
    },
    tags: ['open-ended'],
    recommendedMaterialCategories: ALL_MATERIAL_CATEGORIES,
    essentialDimensionPrompts: ['innerWidthMm', 'innerDepthMm', 'innerHeightMm'],
    settingsFactory: (material) =>
      settings('blank-panel-box', material, {
        innerWidthMm: 80,
        innerDepthMm: 60,
        innerHeightMm: 50,
        jointKind: 'finger',
        fingerWidthMm: 10,
        includeLid: false,
        widthDividerCount: 0,
        depthDividerCount: 0,
        features: [],
      }),
  },
];

const recipesById = new Map(CLASSROOM_RECIPES.map((recipe) => [recipe.id, recipe]));

export function getClassroomRecipe(id: ClassroomRecipeId): ClassroomRecipeDefinition {
  const recipe = recipesById.get(id);
  if (!recipe) throw new Error(`Unknown classroom recipe: ${id}`);
  return recipe;
}

export function resolveClassroomRecipeSettings(
  id: ClassroomRecipeId,
  material: Pick<MaterialProfile, 'clearanceMm' | 'thicknessMm'>,
): PanelComposerSettings {
  return getClassroomRecipe(id).settingsFactory(material);
}

function normalizedFeatures(features: readonly PanelFeature[]): PanelFeature[] {
  return [...features].sort((left, right) => left.id.localeCompare(right.id));
}

export function classroomRecipeSettingsArePristine(
  current: PanelComposerSettings,
  material: Pick<MaterialProfile, 'clearanceMm' | 'thicknessMm'>,
): boolean {
  if (!current.recipe) return false;
  const definition = recipesById.get(current.recipe.id);
  if (!definition || current.recipe.revision !== definition.revision) return false;
  const expected = definition.settingsFactory(material);
  return (
    hashSerializable({ ...current, features: normalizedFeatures(current.features) }) ===
    hashSerializable({ ...expected, features: normalizedFeatures(expected.features) })
  );
}

export function recipeApplicationRequiresConfirmation(
  current: PanelComposerSettings,
  material: Pick<MaterialProfile, 'clearanceMm' | 'thicknessMm'>,
): boolean {
  return Boolean(current.recipe) && !classroomRecipeSettingsArePristine(current, material);
}

export function classroomRecipeMaterialIssues(
  projectMaterial: MaterialProfile,
  settingsValue: PanelComposerSettings,
): ValidationIssue[] {
  if (!settingsValue.recipe) return [];
  const definition = recipesById.get(settingsValue.recipe.id);
  if (!definition || definition.recommendedMaterialCategories.includes(projectMaterial.category)) {
    return [];
  }
  return [
    {
      id: `panel-recipe-material-${definition.id}`,
      severity: 'warning',
      code: 'PANEL_RECIPE_MATERIAL_NOT_RECOMMENDED',
      message: 'The selected material is outside this classroom recipe’s recommendations.',
      messageArgs: { recipeId: definition.id, materialCategory: projectMaterial.category },
      affectedEntityIds: [definition.id, projectMaterial.id],
      suggestedAction: 'Review the recipe guidance or choose a recommended material category.',
    },
  ];
}
