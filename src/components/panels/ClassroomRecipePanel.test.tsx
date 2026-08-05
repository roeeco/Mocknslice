import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '../../app/createProject';
import { useProjectStore } from '../../state/useProjectStore';
import { ClassroomRecipePanel } from './ClassroomRecipePanel';

describe('ClassroomRecipePanel', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: { ...createProject('Recipe test'), fabricationMode: 'panel-construction' },
      past: [],
      future: [],
      validationIssues: [],
      activeWorkflowStep: 'configure',
      completedWorkflowSteps: ['start', 'mode'],
    });
    useProjectStore.getState().setLocale('en');
  });

  afterEach(() => vi.restoreAllMocks());

  it('applies a recipe as one undoable action and preserves every inactive mode', async () => {
    const user = userEvent.setup();
    const before = structuredClone(useProjectStore.getState().project.modeSettings);
    render(<ClassroomRecipePanel />);

    await user.selectOptions(screen.getByLabelText('Panel preset'), 'sorting-tray');
    const state = useProjectStore.getState();
    expect(state.past).toHaveLength(1);
    expect(state.project.modeSettings.panelConstruction).toMatchObject({
      recipe: { id: 'sorting-tray', revision: 1 },
      widthDividerCount: 3,
    });
    expect(state.project.modeSettings.stackedSlices).toEqual(before.stackedSlices);
    expect(state.project.modeSettings.waffleSlices).toEqual(before.waffleSlices);
    expect(state.project.modeSettings.foldTemplate).toEqual(before.foldTemplate);
    expect(state.project.modeSettings.meshUnfold).toEqual(before.meshUnfold);

    state.undo();
    expect(useProjectStore.getState().project.modeSettings.panelConstruction).toEqual(
      before.panelConstruction,
    );
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.modeSettings.panelConstruction.recipe?.id).toBe(
      'sorting-tray',
    );
  });

  it('confirms before replacing edited recipe settings', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ClassroomRecipePanel />);

    await user.selectOptions(screen.getByLabelText('Panel preset'), 'sorting-tray');
    useProjectStore.getState().updatePanelComposerSettings({ innerWidthMm: 333 });
    await user.selectOptions(screen.getByLabelText('Panel preset'), 'blank-panel-box');
    expect(confirm).toHaveBeenCalledOnce();
    expect(useProjectStore.getState().project.modeSettings.panelConstruction.innerWidthMm).toBe(
      333,
    );

    confirm.mockReturnValue(true);
    await user.selectOptions(screen.getByLabelText('Panel preset'), 'blank-panel-box');
    expect(useProjectStore.getState().project.modeSettings.panelConstruction).toMatchObject({
      innerWidthMm: 80,
      recipe: { id: 'blank-panel-box', revision: 1 },
    });
  });

  it('can detach a preset without changing its resolved geometry settings', async () => {
    const user = userEvent.setup();
    render(<ClassroomRecipePanel />);
    const preset = screen.getByLabelText('Panel preset');
    await user.selectOptions(preset, 'sorting-tray');
    const resolved = structuredClone(
      useProjectStore.getState().project.modeSettings.panelConstruction,
    );
    await user.selectOptions(preset, 'custom');

    const custom = useProjectStore.getState().project.modeSettings.panelConstruction;
    delete resolved.recipe;
    expect(custom.recipe).toBeUndefined();
    expect(custom).toEqual(resolved);
    expect(preset).toHaveValue('custom');
  });

  it('exposes keyboard-operable names and localized Hebrew content', async () => {
    useProjectStore.getState().setLocale('he');
    const user = userEvent.setup();
    render(
      <div dir="rtl">
        <ClassroomRecipePanel />
      </div>,
    );

    const sorting = screen.getByLabelText('הגדרה מוכנה ללוחות');
    sorting.focus();
    await user.selectOptions(sorting, 'sorting-tray');
    expect(sorting).toHaveValue('sorting-tray');
    expect(screen.getByRole('option', { name: 'מגש מיון' })).toBeVisible();
    expect(sorting.closest('[dir="rtl"]')).not.toBeNull();
  });

  it('refreshes recipe material warnings when the selected material changes', async () => {
    const user = userEvent.setup();
    render(<ClassroomRecipePanel />);
    await user.selectOptions(screen.getByLabelText('Panel preset'), 'survey-ballot-box');
    expect(
      useProjectStore
        .getState()
        .validationIssues.some((issue) => issue.code === 'PANEL_RECIPE_MATERIAL_NOT_RECOMMENDED'),
    ).toBe(false);

    useProjectStore.getState().selectMaterial('paper-160gsm');
    expect(useProjectStore.getState().validationIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PANEL_RECIPE_MATERIAL_NOT_RECOMMENDED' }),
      ]),
    );
  });
});
