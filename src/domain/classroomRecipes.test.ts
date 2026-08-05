import { describe, expect, it } from 'vitest';
import { getDefaultMaterial } from '../materials/defaultMaterials';
import {
  CLASSROOM_RECIPES,
  classroomRecipeMaterialIssues,
  classroomRecipeSettingsArePristine,
  recipeApplicationRequiresConfirmation,
  resolveClassroomRecipeSettings,
} from './classroomRecipes';

describe('classroom recipe registry', () => {
  const material = getDefaultMaterial('card-300gsm');

  it('resolves all five recipes deterministically to complete panel settings', () => {
    expect(CLASSROOM_RECIPES.map((recipe) => recipe.id)).toEqual([
      'survey-ballot-box',
      'sorting-tray',
      'flash-card-holder',
      'game-component-box',
      'blank-panel-box',
    ]);

    for (const recipe of CLASSROOM_RECIPES) {
      const first = resolveClassroomRecipeSettings(recipe.id, material);
      const second = resolveClassroomRecipeSettings(recipe.id, material);
      expect(second).toEqual(first);
      expect(first).toMatchObject({
        recipe: { id: recipe.id, revision: recipe.revision },
        clearanceMm: material.clearanceMm,
      });
      expect(
        [
          first.innerWidthMm,
          first.innerDepthMm,
          first.innerHeightMm,
          first.fingerWidthMm,
          first.clearanceMm,
          first.widthDividerCount,
          first.depthDividerCount,
        ].every(Number.isFinite),
      ).toBe(true);
    }
  });

  it('uses stable feature IDs and fixed panel targets for future cutouts', () => {
    const features = CLASSROOM_RECIPES.flatMap(
      (recipe) => resolveClassroomRecipeSettings(recipe.id, material).features,
    );
    expect(features.map((feature) => feature.id)).toEqual([
      'survey-response-slot',
      'flash-card-access-notch',
    ]);
    expect(features.every((feature) => !feature.targetRole.startsWith('divider-'))).toBe(true);
  });

  it('reports material guidance without preventing recipe resolution', () => {
    const recommended = resolveClassroomRecipeSettings('survey-ballot-box', material);
    expect(classroomRecipeMaterialIssues(material, recommended)).toEqual([]);

    const paper = getDefaultMaterial('paper-160gsm');
    const settings = resolveClassroomRecipeSettings('game-component-box', paper);
    expect(classroomRecipeMaterialIssues(paper, settings)).toMatchObject([
      {
        severity: 'warning',
        code: 'PANEL_RECIPE_MATERIAL_NOT_RECOMMENDED',
        affectedEntityIds: ['game-component-box', 'paper-160gsm'],
      },
    ]);
  });

  it('requires confirmation only when an applied recipe has been edited or superseded', () => {
    const settings = resolveClassroomRecipeSettings('sorting-tray', material);
    expect(classroomRecipeSettingsArePristine(settings, material)).toBe(true);
    expect(recipeApplicationRequiresConfirmation(settings, material)).toBe(false);

    settings.innerWidthMm += 1;
    expect(classroomRecipeSettingsArePristine(settings, material)).toBe(false);
    expect(recipeApplicationRequiresConfirmation(settings, material)).toBe(true);
  });
});
