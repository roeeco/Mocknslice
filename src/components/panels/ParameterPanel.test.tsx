import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { useProjectStore } from '../../state/useProjectStore';
import { ParameterPanel } from './ParameterPanel';

describe('ParameterPanel', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: createProject('Test project'),
      past: [],
      future: [],
    });
  });

  it('updates the serializable material snapshot and supports undo', async () => {
    const user = userEvent.setup();
    render(<ParameterPanel />);

    await user.selectOptions(screen.getByLabelText('Material profile'), 'plywood-3mm');
    expect(screen.getByText('3 mm plywood')).toBeInTheDocument();
    expect(useProjectStore.getState().project.materialProfileSnapshot.id).toBe('plywood-3mm');
    expect(useProjectStore.getState().project.modeParameters.waffleThicknessMm).toBe(3);
    expect(useProjectStore.getState().project.modeParameters.waffleClearanceMm).toBe(0.15);
    expect(useProjectStore.getState().project.modeParameters.panelClearanceMm).toBe(0.15);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.materialProfileSnapshot.id).toBe('card-300gsm');
    expect(useProjectStore.getState().project.modeParameters.waffleThicknessMm).toBe(0.35);
  });

  it('renames the project with an accessible text field', async () => {
    const user = userEvent.setup();
    render(<ParameterPanel />);

    const input = screen.getByLabelText('Project name');
    await user.clear(input);
    await user.type(input, 'Card study');

    expect(useProjectStore.getState().project.metadata.name).toBe('Card study');
  });
});
