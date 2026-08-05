import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject } from '../../../app/createProject';
import type { PanelFeature } from '../../../domain/modeSettings';
import { useProjectStore } from '../../../state/useProjectStore';
import { PanelComposer } from './PanelComposer';

const recipeFeature: PanelFeature = {
  id: 'recipe-slot',
  kind: 'rectangular-cutout',
  targetRole: 'front',
  anchor: { u: 0.5, v: 0.5 },
  rotationDeg: 0,
  widthMm: 40,
  heightMm: 12,
  purpose: 'Response slot',
};

describe('PanelComposer', () => {
  beforeEach(() => {
    const project = createProject('Composer test');
    project.fabricationMode = 'panel-construction';
    useProjectStore.setState({
      project,
      experienceMode: 'standard',
      selectedEntityId: undefined,
      selectedPartId: undefined,
      validationIssues: [],
      past: [],
      future: [],
      sliceGenerationStatus: 'idle',
    });
    useProjectStore.getState().setLocale('en');
  });

  it('adds, selects, edits, duplicates, deletes, undoes, and redoes features', async () => {
    const user = userEvent.setup();
    useProjectStore.setState({ experienceMode: 'advanced' });
    render(<PanelComposer />);

    await user.click(screen.getByRole('button', { name: /Rectangle opening/ }));
    let state = useProjectStore.getState();
    expect(state.project.modeSettings.panelConstruction.features).toHaveLength(1);
    expect(state.past).toHaveLength(1);
    expect(state.selectedPartId).toBe('construction-part-front');
    expect(screen.getByLabelText('Width (mm)')).toHaveValue(30);

    fireEvent.change(screen.getByLabelText('Width (mm)'), { target: { value: '42' } });
    expect(
      useProjectStore.getState().project.modeSettings.panelConstruction.features[0],
    ).toMatchObject({ widthMm: 42 });

    await user.click(screen.getByRole('button', { name: 'Duplicate feature' }));
    state = useProjectStore.getState();
    expect(state.project.modeSettings.panelConstruction.features).toHaveLength(2);
    const duplicateId = state.selectedEntityId;
    expect(duplicateId).toMatch(/^panel-feature-/);

    await user.click(screen.getByRole('button', { name: 'Delete feature' }));
    expect(useProjectStore.getState().project.modeSettings.panelConstruction.features).toHaveLength(
      1,
    );
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.modeSettings.panelConstruction.features).toHaveLength(
      2,
    );
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.modeSettings.panelConstruction.features).toHaveLength(
      1,
    );
  });

  it('commits one history entry when a local move or resize gesture finishes', () => {
    const project = useProjectStore.getState().project;
    project.modeSettings.panelConstruction.features = [structuredClone(recipeFeature)];
    useProjectStore.setState({
      project,
      selectedEntityId: recipeFeature.id,
      selectedPartId: 'construction-part-front',
      past: [],
    });
    Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
      configurable: true,
      value: () => ({ inverse: () => ({}) }),
    });
    Object.defineProperty(SVGSVGElement.prototype, 'createSVGPoint', {
      configurable: true,
      value: () => ({
        x: 0,
        y: 0,
        matrixTransform() {
          return { x: this.x, y: this.y };
        },
      }),
    });
    Object.defineProperty(SVGElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    render(<PanelComposer />);
    const feature = document.querySelector<SVGGElement>('[data-feature-id="recipe-slot"]')!;
    const preview = screen.getByLabelText(/Panel-local preview/);

    fireEvent.pointerDown(feature, { pointerId: 7, button: 0, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(preview, { pointerId: 7, clientX: 60, clientY: 40 });
    expect(useProjectStore.getState().past).toHaveLength(0);
    fireEvent.pointerUp(preview, { pointerId: 7, clientX: 60, clientY: 40 });

    expect(useProjectStore.getState().past).toHaveLength(1);
    expect(
      useProjectStore.getState().project.modeSettings.panelConstruction.features[0],
    ).toMatchObject({ offsetMm: { x: 10, y: 10 } });

    const resizeHandle = screen.getByRole('button', { name: 'Resize feature' });
    fireEvent.pointerDown(resizeHandle, {
      pointerId: 8,
      button: 0,
      clientX: 70,
      clientY: 50,
    });
    fireEvent.pointerMove(preview, { pointerId: 8, clientX: 75, clientY: 45 });
    expect(useProjectStore.getState().past).toHaveLength(1);
    fireEvent.pointerUp(preview, { pointerId: 8, clientX: 75, clientY: 45 });

    expect(useProjectStore.getState().past).toHaveLength(2);
    expect(
      useProjectStore.getState().project.modeSettings.panelConstruction.features[0],
    ).toMatchObject({ widthMm: 50, heightMm: 22 });
  });

  it('moves with keyboard modifiers without reversing coordinates in Hebrew RTL', () => {
    const project = useProjectStore.getState().project;
    project.modeSettings.panelConstruction.features = [structuredClone(recipeFeature)];
    useProjectStore.setState({
      project,
      selectedEntityId: recipeFeature.id,
      selectedPartId: 'construction-part-front',
      past: [],
    });
    act(() => useProjectStore.getState().setLocale('he'));
    render(
      <div dir="rtl">
        <PanelComposer />
      </div>,
    );
    const feature = document.querySelector<SVGGElement>('[data-feature-id="recipe-slot"]')!;
    fireEvent.keyDown(feature, { key: 'ArrowRight' });
    fireEvent.keyDown(feature, { key: 'ArrowUp', shiftKey: true });
    fireEvent.keyDown(feature, { key: 'ArrowLeft', altKey: true });

    expect(
      useProjectStore.getState().project.modeSettings.panelConstruction.features[0],
    ).toMatchObject({ offsetMm: { x: 0.9, y: 10 } });
    expect(useProjectStore.getState().past).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'פתחים ותוויות' })).toBeVisible();
  });

  it('keeps recipe features editable and shows affected structured validation', () => {
    const project = useProjectStore.getState().project;
    project.modeSettings.panelConstruction.features = [structuredClone(recipeFeature)];
    useProjectStore.setState({
      project,
      selectedEntityId: recipeFeature.id,
      selectedPartId: 'construction-part-front',
      validationIssues: [
        {
          id: 'feature-outside',
          severity: 'error',
          code: 'PANEL_FEATURE_OUTSIDE_PANEL',
          message: 'Response slot extends outside the panel.',
          affectedEntityIds: [recipeFeature.id, 'construction-panel-front'],
        },
      ],
    });
    render(<PanelComposer />);

    expect(screen.getByLabelText('Width (mm)')).toHaveValue(40);
    expect(screen.getByText('Response slot extends outside the panel.')).toBeVisible();
    fireEvent.change(screen.getByLabelText('Width (mm)'), { target: { value: '55' } });
    expect(
      useProjectStore.getState().project.modeSettings.panelConstruction.features[0],
    ).toMatchObject({ id: 'recipe-slot', widthMm: 55 });
  });

  it('keeps precision controls in Advanced while Standard retains numeric fallbacks', () => {
    const project = useProjectStore.getState().project;
    project.modeSettings.panelConstruction.features = [structuredClone(recipeFeature)];
    useProjectStore.setState({
      project,
      selectedEntityId: recipeFeature.id,
      selectedPartId: 'construction-part-front',
    });
    const view = render(<PanelComposer />);
    expect(screen.getByLabelText('Horizontal position (mm)')).toBeVisible();
    expect(screen.queryByLabelText('Counter-clockwise rotation (°)')).toBeNull();
    view.unmount();

    useProjectStore.setState({ experienceMode: 'advanced' });
    render(<PanelComposer />);
    expect(screen.getByLabelText('Counter-clockwise rotation (°)')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Duplicate feature' })).toBeVisible();
  });

  it('follows owning-panel selection from the shared 2D and 3D selection state', () => {
    useProjectStore.setState({
      selectedEntityId: 'construction-panel-left',
      selectedPartId: 'construction-part-left',
    });
    render(<PanelComposer />);

    expect(screen.getByRole('button', { name: /^Left$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/Panel-local preview: Left/)).toBeVisible();
  });
});
