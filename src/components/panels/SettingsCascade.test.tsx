import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '../../app/createProject';
import { useProjectStore } from '../../state/useProjectStore';
import { FabricationOutputPanel } from './FabricationOutputPanel';
import { FoldTemplatePanel } from './FoldTemplatePanel';
import { MeshUnfoldPanel } from './MeshUnfoldPanel';
import { PanelConstructionPanel } from './PanelConstructionPanel';
import { StackedSlicePanel } from './StackedSlicePanel';
import { WaffleSlicePanel } from './WaffleSlicePanel';

function setMode(fabricationMode: ReturnType<typeof createProject>['fabricationMode']) {
  useProjectStore.setState((state) => ({
    project: { ...state.project, fabricationMode },
    experienceMode: 'standard',
  }));
}

describe('Standard and Advanced settings cascade', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: createProject('Settings cascade'),
      experienceMode: 'standard',
      sliceGenerationStatus: 'idle',
      sliceGenerationError: undefined,
    });
    useProjectStore.getState().setLocale('en');
  });

  it('keeps panel essentials in Standard and reveals joint tuning in Advanced', () => {
    setMode('panel-construction');
    const view = render(<PanelConstructionPanel hideGenerationAction />);
    expect(screen.getByLabelText('Inside width (mm)')).toBeVisible();
    expect(screen.getByLabelText('Dividers across width')).toBeVisible();
    expect(screen.getByLabelText('Dividers across depth')).toBeVisible();
    expect(screen.queryByLabelText('Target finger width (mm)')).toBeNull();
    act(() => useProjectStore.getState().setExperienceMode('advanced'));
    expect(screen.getByLabelText('Target finger width (mm)')).toBeVisible();
    view.unmount();
  });

  it('keeps family geometry in Standard and reveals folding tuning in Advanced', () => {
    setMode('fold-template');
    useProjectStore.getState().updateFoldTemplateSettings({ templateKind: 'box-with-lid' });
    const view = render(<FoldTemplatePanel hideGenerationAction />);
    expect(screen.getByLabelText('Width (X)')).toBeVisible();
    expect(screen.queryByLabelText('Glue tab depth')).toBeNull();
    act(() => useProjectStore.getState().setExperienceMode('advanced'));
    expect(screen.getByLabelText('Connection method')).toBeVisible();
    expect(screen.getByLabelText('Glue tab depth')).toBeVisible();
    expect(screen.getByLabelText('Lid wall depth')).toBeVisible();
    expect(screen.getByLabelText('Profile tolerance')).toBeVisible();
    view.unmount();
  });

  it('cascades slice, waffle, mesh, and output tuning without resetting hidden values', () => {
    setMode('stacked-slices');
    useProjectStore.getState().updateStackedSliceSettings({ thicknessMm: 7.25 });
    const stacked = render(<StackedSlicePanel hideGenerationAction />);
    expect(screen.queryByLabelText('Part thickness')).toBeNull();
    act(() => useProjectStore.getState().setExperienceMode('advanced'));
    expect(screen.getByLabelText('Part thickness')).toHaveValue(7.25);
    stacked.unmount();

    setMode('waffle-slices');
    const waffle = render(<WaffleSlicePanel hideGenerationAction />);
    expect(screen.queryByLabelText('Slot clearance')).toBeNull();
    act(() => useProjectStore.getState().setExperienceMode('advanced'));
    expect(screen.getByLabelText('Slot clearance')).toBeVisible();
    waffle.unmount();

    setMode('mesh-unfold');
    const mesh = render(<MeshUnfoldPanel hideGenerationAction />);
    expect(screen.getByText('Automatic unfolding')).toBeVisible();
    expect(screen.queryByLabelText('Seam strategy')).toBeNull();
    act(() => useProjectStore.getState().setExperienceMode('advanced'));
    expect(screen.getByLabelText('Seam strategy')).toBeVisible();
    mesh.unmount();

    useProjectStore.setState({ experienceMode: 'standard' });
    const output = render(<FabricationOutputPanel />);
    expect(screen.getByLabelText('Fold-line output')).toBeVisible();
    expect(screen.getByLabelText('Printable labels')).toBeVisible();
    expect(screen.queryByLabelText('Kerf compensation')).toBeNull();
    act(() => useProjectStore.getState().setExperienceMode('advanced'));
    expect(screen.getByLabelText('Kerf compensation')).toBeVisible();
    output.unmount();

    expect(useProjectStore.getState().project.modeSettings.stackedSlices.thicknessMm).toBe(7.25);
  });

  it('localizes advanced folding, unfolding, output controls, and statuses in Hebrew', () => {
    act(() => {
      useProjectStore.getState().setLocale('he');
      useProjectStore.setState({ experienceMode: 'advanced' });
    });
    setMode('fold-template');
    act(() => {
      useProjectStore.setState({ experienceMode: 'advanced' });
      useProjectStore.getState().updateFoldTemplateSettings({ templateKind: 'box-with-lid' });
    });
    const fold = render(<FoldTemplatePanel hideGenerationAction />);
    expect(screen.getByText('הגדרות מתקדמות')).toBeVisible();
    expect(screen.getByLabelText('עומק לשונית הדבקה')).toBeVisible();
    expect(screen.getByLabelText('עומק דופן המכסה')).toBeVisible();
    expect(screen.getByLabelText('מרווח המכסה')).toBeVisible();
    expect(screen.getByLabelText('סבילות פרופיל')).toBeVisible();
    expect(screen.getByText('מוכן')).toBeVisible();
    fold.unmount();

    setMode('mesh-unfold');
    act(() => useProjectStore.setState({ experienceMode: 'advanced' }));
    const mesh = render(<MeshUnfoldPanel hideGenerationAction />);
    expect(screen.getByLabelText('אסטרטגיית תפרים')).toBeVisible();
    expect(screen.getByLabelText('מגבלת פאות')).toBeVisible();
    expect(screen.getByLabelText('ניסיונות חיפוש')).toBeVisible();
    mesh.unmount();

    const output = render(<FabricationOutputPanel />);
    expect(screen.getByLabelText('פיצוי רוחב חיתוך')).toBeVisible();
    expect(screen.getByText('סגנונות פעולה')).toBeVisible();
    output.unmount();
    act(() => useProjectStore.getState().setLocale('en'));
  });
});
