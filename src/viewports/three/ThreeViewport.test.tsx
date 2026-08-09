import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '../../app/createProject';
import { generatePanelConstruction } from '../../geometry/panelConstruction/generatePanelConstruction';
import { useProjectStore } from '../../state/useProjectStore';
import { ThreeViewport } from './ThreeViewport';

vi.mock('@react-three/fiber', () => ({
  Canvas: ({
    children,
    onPointerMissed,
  }: {
    children?: ReactNode;
    onPointerMissed?: () => void;
  }) => (
    <button type="button" data-testid="mock-canvas" onClick={onPointerMissed}>
      {children}
    </button>
  ),
}));

vi.mock('./ModelScene', () => ({ ModelScene: () => null }));

describe('ThreeViewport', () => {
  beforeEach(() => {
    const project = createProject('Dismiss connection editor');
    project.fabricationMode = 'panel-construction';
    const result = generatePanelConstruction({
      sourceId: 'panel-construction',
      material: {
        id: project.materialProfileSnapshot.id,
        category: project.materialProfileSnapshot.category,
        thicknessMm: project.modeSettings.panelConstruction.panelThicknessMm,
        kerfMm: project.materialProfileSnapshot.kerfMm,
      },
      settings: project.modeSettings.panelConstruction,
    });
    useProjectStore.setState({
      project: { ...project, panelConstructionResult: result, generatedParts: result.parts },
      selectedEntityId: 'base-front',
      selectedPartId: 'construction-part-base',
    });
  });

  it('closes the selected edge editor when empty 3D space is clicked', () => {
    render(<ThreeViewport />);

    fireEvent.click(screen.getByTestId('mock-canvas'));

    expect(useProjectStore.getState().selectedEntityId).toBeUndefined();
    expect(useProjectStore.getState().selectedPartId).toBeUndefined();
  });

  it('keeps a non-edge selection when empty 3D space is clicked', () => {
    useProjectStore.getState().selectEntity('construction-panel-base', 'construction-part-base');
    render(<ThreeViewport />);

    fireEvent.click(screen.getByTestId('mock-canvas'));

    expect(useProjectStore.getState().selectedEntityId).toBe('construction-panel-base');
  });
});
