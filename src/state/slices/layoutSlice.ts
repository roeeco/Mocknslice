import type { SheetLayout } from '../../domain/fabrication';
import { arrangePartsInRows } from '../../geometry/layout/arrangeParts';
import { boundsForPart, normalizedRotation } from '../../geometry/layout/partPlacement';
import { validationIssuesForProject } from '../../validation/projectValidation';
import { recordProjectChange, touchProject } from '../projectChange';
import type { AppSliceCreator, AppState, LayoutSlice } from '../types';

function updateProject(
  state: AppState,
  updater: (layouts: SheetLayout[]) => SheetLayout[],
): Partial<AppState> {
  const changed = recordProjectChange(state, (project) =>
    touchProject({ ...project, sheetLayouts: updater(project.sheetLayouts) }),
  );
  const project = changed.project ?? state.project;
  return {
    ...changed,
    validationIssues: validationIssuesForProject(project),
    completedWorkflowSteps: state.completedWorkflowSteps.filter((step) => step !== 'arrange'),
  };
}

function nextSheetId(): string {
  return `sheet-${crypto.randomUUID()}`;
}

export const createLayoutSlice: AppSliceCreator<LayoutSlice> = (set) => ({
  activeSheetId: undefined,
  setActiveSheet: (activeSheetId) => set({ activeSheetId }),
  arrangeGeneratedParts: () =>
    set((state) => {
      const template =
        state.project.sheetLayouts.find((sheet) => sheet.id === state.activeSheetId) ??
        state.project.sheetLayouts[0];
      if (!template) return state;
      const layouts = arrangePartsInRows(state.project.generatedParts, template);
      const changed = recordProjectChange(state, (project) =>
        touchProject({ ...project, sheetLayouts: layouts }),
      );
      const project = changed.project ?? state.project;
      return {
        ...changed,
        activeSheetId: layouts[0]?.id,
        validationIssues: validationIssuesForProject(project),
        activeWorkflowStep: 'arrange',
      };
    }),
  updateSheetSettings: (sheetId, settings) =>
    set((state) =>
      updateProject(state, (layouts) =>
        layouts.map((sheet) => (sheet.id === sheetId ? { ...sheet, ...settings } : sheet)),
      ),
    ),
  addSheet: () =>
    set((state) => {
      const material = state.project.materialProfileSnapshot;
      const sheet: SheetLayout = {
        id: nextSheetId(),
        widthMm: material.defaultSheetWidthMm,
        heightMm: material.defaultSheetHeightMm,
        marginMm: 5,
        spacingMm: 3,
        placements: [],
      };
      return {
        ...updateProject(state, (layouts) => [...layouts, sheet]),
        activeSheetId: sheet.id,
      };
    }),
  duplicateSheet: (sheetId) =>
    set((state) => {
      const source = state.project.sheetLayouts.find((sheet) => sheet.id === sheetId);
      if (!source) return state;
      const sheet = { ...source, id: nextSheetId(), placements: [] };
      return {
        ...updateProject(state, (layouts) => [...layouts, sheet]),
        activeSheetId: sheet.id,
      };
    }),
  removeSheet: (sheetId) =>
    set((state) => {
      if (state.project.sheetLayouts.length <= 1) return state;
      const layouts = state.project.sheetLayouts.filter((sheet) => sheet.id !== sheetId);
      return {
        ...updateProject(state, () => layouts),
        activeSheetId: state.activeSheetId === sheetId ? layouts[0]?.id : state.activeSheetId,
      };
    }),
  updatePartPlacement: (sheetId, partId, placement) =>
    set((state) =>
      updateProject(state, (layouts) =>
        layouts.map((sheet) =>
          sheet.id === sheetId
            ? {
                ...sheet,
                placements: sheet.placements.map((current) =>
                  current.partId === partId
                    ? {
                        ...current,
                        x: placement.x,
                        y: placement.y,
                        rotationDeg:
                          placement.rotationDeg === undefined
                            ? current.rotationDeg
                            : normalizedRotation(placement.rotationDeg),
                      }
                    : current,
                ),
              }
            : sheet,
        ),
      ),
    ),
  rotatePartPlacement: (sheetId, partId, deltaDeg = 90) =>
    set((state) =>
      updateProject(state, (layouts) =>
        layouts.map((sheet) =>
          sheet.id === sheetId
            ? {
                ...sheet,
                placements: sheet.placements.map((placement) =>
                  placement.partId === partId
                    ? {
                        ...placement,
                        rotationDeg: normalizedRotation(placement.rotationDeg + deltaDeg),
                      }
                    : placement,
                ),
              }
            : sheet,
        ),
      ),
    ),
  movePartToSheet: (partId, sheetId) =>
    set((state) => {
      const part = state.project.generatedParts.find((candidate) => candidate.id === partId);
      const sheet = state.project.sheetLayouts.find((candidate) => candidate.id === sheetId);
      const bounds = part ? boundsForPart(part) : undefined;
      if (!part || !sheet || !bounds) return state;
      return {
        ...updateProject(state, (layouts) =>
          layouts.map((candidate) => ({
            ...candidate,
            placements: [
              ...candidate.placements.filter((placement) => placement.partId !== partId),
              ...(candidate.id === sheetId
                ? [
                    {
                      partId,
                      x: candidate.marginMm - bounds.minX,
                      y: candidate.marginMm - bounds.minY,
                      rotationDeg: 0,
                    },
                  ]
                : []),
            ],
          })),
        ),
        activeSheetId: sheetId,
        selectedEntityId: partId,
      };
    }),
});
