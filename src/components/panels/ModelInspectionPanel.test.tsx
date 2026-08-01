import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { normalizeMesh } from '../../geometry/mesh/normalizeMesh';
import { useProjectStore } from '../../state/useProjectStore';
import { ModelInspectionPanel } from './ModelInspectionPanel';

describe('ModelInspectionPanel', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: createProject('Inspection test'),
      past: [],
      future: [],
      modelImportStatus: 'idle',
      modelImportError: undefined,
    });
    useProjectStore.getState().completeModelImport(
      'fixture.stl',
      normalizeMesh(
        {
          positions: [0, 0, 0, 10, 0, 0, 0, 20, 0, 0, 0, 0, 0, 0, 30, 10, 0, 0],
        },
        { assumedUnit: 'millimetres' },
      ),
    );
  });

  it('shows deterministic health data and corrects dimensions uniformly', async () => {
    const user = userEvent.setup();
    render(<ModelInspectionPanel />);

    expect(screen.getByText('fixture.stl')).toBeInTheDocument();
    expect(screen.getByText('Model health')).toBeInTheDocument();

    const longest = screen.getByLabelText('Longest dimension');
    await user.clear(longest);
    await user.type(longest, '60{Enter}');

    expect(useProjectStore.getState().project.model.dimensions).toEqual({
      widthMm: 20,
      heightMm: 40,
      depthMm: 60,
    });
  });

  it('rotates imported geometry through undoable project state', async () => {
    const user = userEvent.setup();
    render(<ModelInspectionPanel />);
    await user.click(screen.getByRole('button', { name: 'Around X' }));

    expect(useProjectStore.getState().project.model.dimensions).toEqual({
      widthMm: 10,
      heightMm: 30,
      depthMm: 20,
    });
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.model.dimensions).toEqual({
      widthMm: 10,
      heightMm: 20,
      depthMm: 30,
    });
  });
});
