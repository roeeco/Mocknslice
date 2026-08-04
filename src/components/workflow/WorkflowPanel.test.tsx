import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { useProjectStore } from '../../state/useProjectStore';
import { WorkflowNavigation } from './WorkflowNavigation';
import { WorkflowPanel } from './WorkflowPanel';

describe('wizard workflow', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: createProject('Wizard test'),
      activeWorkflowStep: 'start',
      completedWorkflowSteps: [],
      sliceGenerationStatus: 'idle',
      sliceGenerationError: undefined,
      past: [],
      future: [],
      experienceMode: 'standard',
    });
    useProjectStore.getState().setLocale('en');
  });

  it('shows only the active step and unlocks completed navigation', async () => {
    const user = userEvent.setup();
    render(
      <>
        <WorkflowNavigation />
        <WorkflowPanel />
      </>,
    );

    expect(screen.getByRole('heading', { name: 'Start a project' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Choose a fabrication mode' })).toBeNull();
    expect(screen.getByRole('button', { name: /Choose mode/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Choose a fabrication mode' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Start/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Import or create/ })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Start/ }));
    expect(screen.getByRole('heading', { name: 'Start a project' })).toBeVisible();
  });

  it('blocks Next when the project name is empty', async () => {
    const user = userEvent.setup();
    render(<WorkflowPanel />);
    await user.clear(screen.getByLabelText('Project name'));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('shows a large SVG illustration for every fabrication mode', () => {
    useProjectStore.setState({ activeWorkflowStep: 'mode' });
    const { container } = render(<WorkflowPanel />);

    expect(container.querySelectorAll('.mode-choice')).toHaveLength(4);
    expect(container.querySelectorAll('img.mode-icon')).toHaveLength(4);
    expect(
      [...container.querySelectorAll<HTMLImageElement>('img.mode-icon')].every((icon) =>
        icon.src.endsWith('.svg'),
      ),
    ).toBe(true);
  });

  it('switches between STL import and illustrated template creation', async () => {
    const user = userEvent.setup();
    const project = createProject('Folding source test');
    project.fabricationMode = 'mesh-unfold';
    useProjectStore.setState({
      project,
      activeWorkflowStep: 'import',
      completedWorkflowSteps: ['start', 'mode'],
    });
    const { container } = render(<WorkflowPanel />);

    expect(screen.getByRole('heading', { name: 'Import STL model' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Create from template' }));

    expect(container.querySelectorAll('svg.template-choice-icon')).toHaveLength(7);
    expect(useProjectStore.getState().project).toMatchObject({
      fabricationMode: 'fold-template',
      modeParameters: {
        workflowSourceMode: 'template',
        foldTemplateKind: 'open-box',
        foldSizeMode: 'custom',
      },
    });

    await user.click(screen.getByRole('button', { name: 'Profile sleeve' }));
    expect(useProjectStore.getState().project.modeParameters.foldTemplateKind).toBe('sleeve');

    await user.click(screen.getByRole('button', { name: 'Import model' }));
    expect(screen.getByRole('heading', { name: 'Import STL model' })).toBeVisible();
    expect(useProjectStore.getState().project.modeParameters.workflowSourceMode).toBe('import');
    expect(useProjectStore.getState().project.fabricationMode).toBe('mesh-unfold');
  });

  it('offers template creation only inside the folding and unfolding path', () => {
    useProjectStore.setState({ activeWorkflowStep: 'import' });
    render(<WorkflowPanel />);

    expect(screen.queryByRole('button', { name: 'Create from template' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Import STL model' })).toBeVisible();
  });

  it('applies standard sheet size presets in the arrange step', async () => {
    const user = userEvent.setup();
    useProjectStore.setState({ activeWorkflowStep: 'arrange', experienceMode: 'advanced' });
    render(<WorkflowPanel />);

    await user.click(screen.getByRole('button', { name: /A3/ }));
    expect(useProjectStore.getState().project.sheetLayouts[0]).toMatchObject({
      widthMm: 297,
      heightMm: 420,
    });

    await user.click(screen.getByRole('button', { name: /500 × 700/ }));
    expect(useProjectStore.getState().project.sheetLayouts[0]).toMatchObject({
      widthMm: 500,
      heightMm: 700,
    });
  });

  it('numbers the currently visible workflow instead of using fixed phase numbers', () => {
    useProjectStore.setState((state) => ({
      project: { ...state.project, fabricationMode: 'panel-construction' },
      activeWorkflowStep: 'configure',
      experienceMode: 'standard',
    }));
    const view = render(<WorkflowPanel />);
    expect(screen.getByText('Step 3 / 4')).toBeVisible();
    view.unmount();

    useProjectStore.setState((state) => ({
      project: { ...state.project, fabricationMode: 'stacked-slices' },
      activeWorkflowStep: 'configure',
      experienceMode: 'advanced',
    }));
    render(<WorkflowPanel />);
    expect(screen.getByText('Step 4 / 7')).toBeVisible();
  });

  it('stores editable custom material values in the project snapshot', async () => {
    const user = userEvent.setup();
    useProjectStore.setState({ activeWorkflowStep: 'configure' });
    render(<WorkflowPanel />);

    await user.selectOptions(screen.getByLabelText('Material profile'), 'custom-material');
    const thickness = screen.getByLabelText('Thickness (mm)');
    await user.clear(thickness);
    await user.type(thickness, '5.5');

    expect(useProjectStore.getState().project.materialProfileSnapshot).toMatchObject({
      id: 'custom-material',
      category: 'custom',
      thicknessMm: 5.5,
    });
  });
});
