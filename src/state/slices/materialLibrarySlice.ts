import { DEFAULT_MATERIALS, getDefaultMaterial } from '../../materials/defaultMaterials';
import type { AppSliceCreator, MaterialLibrarySlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';
import { generationInputChanged } from '../../domain/generationInputs';
import { validationIssuesForProject } from '../../validation/projectValidation';
import { clampPanelThickness } from '../../domain/panelConstruction';

export const createMaterialLibrarySlice: AppSliceCreator<MaterialLibrarySlice> = (set) => ({
  materials: DEFAULT_MATERIALS,
  selectMaterial: (id) =>
    set((state) => {
      const material = getDefaultMaterial(id);
      const changed = recordProjectChange(state, (project) => {
        const previous = project.materialProfileSnapshot;
        const modeSettings = structuredClone(project.modeSettings);
        if (modeSettings.stackedSlices.thicknessMm === previous.thicknessMm)
          modeSettings.stackedSlices.thicknessMm = material.thicknessMm;
        if (modeSettings.waffleSlices.thicknessMm === previous.thicknessMm)
          modeSettings.waffleSlices.thicknessMm = material.thicknessMm;
        if (modeSettings.waffleSlices.clearanceMm === previous.clearanceMm)
          modeSettings.waffleSlices.clearanceMm = material.clearanceMm;
        if (modeSettings.foldTemplate.slotClearanceMm === previous.clearanceMm)
          modeSettings.foldTemplate.slotClearanceMm = material.clearanceMm;
        if (modeSettings.panelConstruction.clearanceMm === previous.clearanceMm)
          modeSettings.panelConstruction.clearanceMm = material.clearanceMm;
        const previousPanelThickness = clampPanelThickness(previous.thicknessMm);
        const nextPanelThickness = clampPanelThickness(material.thicknessMm);
        if (modeSettings.panelConstruction.panelThicknessMm === previousPanelThickness)
          modeSettings.panelConstruction.panelThicknessMm = nextPanelThickness;
        if (modeSettings.panelConstruction.dividerThicknessMm === previousPanelThickness)
          modeSettings.panelConstruction.dividerThicknessMm = nextPanelThickness;
        if (modeSettings.panelConstruction.lidThicknessMm === previousPanelThickness)
          modeSettings.panelConstruction.lidThicknessMm = nextPanelThickness;
        return touchProject({
          ...project,
          modeSettings,
          materialProfileSnapshot: material,
          exportSettings: {
            ...project.exportSettings,
            customKerfMm:
              project.exportSettings.customKerfMm === previous.kerfMm
                ? material.kerfMm
                : project.exportSettings.customKerfMm,
          },
        });
      });
      const nextProject = changed.project ?? state.project;
      const activeInputChanged = generationInputChanged(state.project, nextProject);
      return {
        ...changed,
        sliceGenerationStatus:
          state.project.generatedParts.length > 0 && activeInputChanged
            ? 'stale'
            : state.sliceGenerationStatus,
        completedWorkflowSteps: activeInputChanged
          ? state.completedWorkflowSteps.filter((step) =>
              ['start', 'mode', 'import'].includes(step),
            )
          : state.completedWorkflowSteps,
        validationIssues: validationIssuesForProject(nextProject),
      };
    }),
  updateCustomMaterial: (patch) =>
    set((state) => {
      if (state.project.materialProfileSnapshot.id !== 'custom-material') return state;
      const changed = recordProjectChange(state, (project) => {
        const previous = project.materialProfileSnapshot;
        const material = {
          ...previous,
          ...patch,
          id: 'custom-material',
          category: 'custom' as const,
        };
        const modeSettings = structuredClone(project.modeSettings);
        if (modeSettings.stackedSlices.thicknessMm === previous.thicknessMm)
          modeSettings.stackedSlices.thicknessMm = material.thicknessMm;
        if (modeSettings.waffleSlices.thicknessMm === previous.thicknessMm)
          modeSettings.waffleSlices.thicknessMm = material.thicknessMm;
        if (modeSettings.waffleSlices.clearanceMm === previous.clearanceMm)
          modeSettings.waffleSlices.clearanceMm = material.clearanceMm;
        if (modeSettings.foldTemplate.slotClearanceMm === previous.clearanceMm)
          modeSettings.foldTemplate.slotClearanceMm = material.clearanceMm;
        if (modeSettings.panelConstruction.clearanceMm === previous.clearanceMm)
          modeSettings.panelConstruction.clearanceMm = material.clearanceMm;
        const previousPanelThickness = clampPanelThickness(previous.thicknessMm);
        const nextPanelThickness = clampPanelThickness(material.thicknessMm);
        if (modeSettings.panelConstruction.panelThicknessMm === previousPanelThickness)
          modeSettings.panelConstruction.panelThicknessMm = nextPanelThickness;
        if (modeSettings.panelConstruction.dividerThicknessMm === previousPanelThickness)
          modeSettings.panelConstruction.dividerThicknessMm = nextPanelThickness;
        if (modeSettings.panelConstruction.lidThicknessMm === previousPanelThickness)
          modeSettings.panelConstruction.lidThicknessMm = nextPanelThickness;
        return touchProject({
          ...project,
          modeSettings,
          materialProfileSnapshot: material,
          exportSettings: {
            ...project.exportSettings,
            customKerfMm:
              project.exportSettings.customKerfMm === previous.kerfMm
                ? material.kerfMm
                : project.exportSettings.customKerfMm,
          },
        });
      });
      const nextProject = changed.project ?? state.project;
      const activeInputChanged = generationInputChanged(state.project, nextProject);
      return {
        ...changed,
        sliceGenerationStatus:
          state.project.generatedParts.length > 0 && activeInputChanged
            ? 'stale'
            : state.sliceGenerationStatus,
        completedWorkflowSteps: activeInputChanged
          ? state.completedWorkflowSteps.filter((step) =>
              ['start', 'mode', 'import'].includes(step),
            )
          : state.completedWorkflowSteps,
        validationIssues: validationIssuesForProject(nextProject),
      };
    }),
});
