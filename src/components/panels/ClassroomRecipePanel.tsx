import {
  CLASSROOM_RECIPES,
  classroomRecipeSettingsArePristine,
  recipeApplicationRequiresConfirmation,
  type ClassroomRecipeId,
} from '../../domain/classroomRecipes';
import { copy } from '../../locales';
import { useProjectStore } from '../../state/useProjectStore';

export function ClassroomRecipeSelect() {
  const locale = useProjectStore((state) => state.locale);
  const project = useProjectStore((state) => state.project);
  const applyPanelRecipe = useProjectStore((state) => state.applyPanelRecipe);
  const replacePanelComposerSettings = useProjectStore(
    (state) => state.replacePanelComposerSettings,
  );
  const settings = project.modeSettings.panelConstruction;
  const material = project.materialProfileSnapshot;
  const pristine = classroomRecipeSettingsArePristine(settings, material);
  const value = settings.recipe && pristine ? settings.recipe.id : 'custom';

  const apply = (recipeId: ClassroomRecipeId) => {
    if (
      recipeApplicationRequiresConfirmation(settings, material) &&
      !window.confirm(copy.classroomRecipes.replaceConfirmation)
    ) {
      return;
    }
    applyPanelRecipe(recipeId);
  };

  return (
    <div className="field-stack panel-preset-field">
      <label htmlFor="panel-construction-preset">{copy.classroomRecipes.preset}</label>
      <select
        id="panel-construction-preset"
        value={value}
        onChange={(event) => {
          if (event.target.value === 'custom') {
            const custom = structuredClone(settings);
            delete custom.recipe;
            replacePanelComposerSettings(custom);
          } else {
            apply(event.target.value as ClassroomRecipeId);
          }
        }}
      >
        <option value="custom">{copy.classroomRecipes.customPreset}</option>
        {CLASSROOM_RECIPES.map((recipe) => (
          <option key={recipe.id} value={recipe.id}>
            {recipe.title[locale]}
          </option>
        ))}
      </select>
      <p className="field-help">{copy.classroomRecipes.presetHelp}</p>
    </div>
  );
}

/** Compatibility export for focused tests and older imports. */
export const ClassroomRecipePanel = ClassroomRecipeSelect;
