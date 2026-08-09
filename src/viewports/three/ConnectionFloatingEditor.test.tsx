import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { generatePanelConstruction } from '../../geometry/panelConstruction/generatePanelConstruction';
import { useProjectStore } from '../../state/useProjectStore';
import { ConnectionFloatingEditor } from './ConnectionFloatingEditor';

describe('ConnectionFloatingEditor', () => {
  beforeEach(() => {
    const project = createProject('Floating connection editor');
    project.fabricationMode = 'panel-construction';
    const result = generatePanelConstruction({
      sourceId: 'panel-construction',
      material: {
        id: project.materialProfileSnapshot.id,
        category: project.materialProfileSnapshot.category,
        thicknessMm: 3,
        kerfMm: project.materialProfileSnapshot.kerfMm,
      },
      settings: project.modeSettings.panelConstruction,
    });
    useProjectStore.setState({
      project: { ...project, panelConstructionResult: result, generatedParts: result.parts },
      sliceGenerationStatus: 'ready',
      past: [],
      future: [],
    });
  });

  it('changes treatment and glue-tab ownership in one anchored control', async () => {
    const user = userEvent.setup();
    const edge = useProjectStore
      .getState()
      .project.panelConstructionResult!.editableEdges!.find(
        (candidate) => candidate.id === 'base-front',
      )!;
    render(<ConnectionFloatingEditor mode="panel-construction" edge={edge} />);

    await user.click(screen.getByRole('button', { name: 'Butt joint' }));
    expect(
      useProjectStore.getState().project.modeSettings.panelConstruction.connectionOverrides[
        'base-front'
      ],
    ).toEqual({ treatment: 'butt' });

    await user.click(screen.getByRole('button', { name: /Glue tab: Base/ }));
    expect(
      useProjectStore.getState().project.modeSettings.panelConstruction.connectionOverrides[
        'base-front'
      ],
    ).toEqual({
      treatment: 'butt',
      glueTabOwnerPanelId: 'construction-panel-base',
    });
    expect(useProjectStore.getState().past).toHaveLength(2);
  });
});
