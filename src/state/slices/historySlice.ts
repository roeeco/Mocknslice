import type { AppSliceCreator, HistorySlice } from '../types';
import { validationIssuesForProject } from '../../validation/projectValidation';

export const createHistorySlice: AppSliceCreator<HistorySlice> = (set) => ({
  past: [],
  future: [],
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1);
      if (!previous) return state;

      return {
        project: previous,
        past: state.past.slice(0, -1),
        future: [state.project, ...state.future],
        autosaveStatus: 'pending',
        validationIssues: validationIssuesForProject(previous),
        sliceGenerationStatus: previous.generatedParts.length > 0 ? 'ready' : 'idle',
        activeSheetId: previous.sheetLayouts.some((sheet) => sheet.id === state.activeSheetId)
          ? state.activeSheetId
          : previous.sheetLayouts[0]?.id,
      };
    }),
  redo: () =>
    set((state) => {
      const [next, ...remaining] = state.future;
      if (!next) return state;

      return {
        project: next,
        past: [...state.past, state.project],
        future: remaining,
        autosaveStatus: 'pending',
        validationIssues: validationIssuesForProject(next),
        sliceGenerationStatus: next.generatedParts.length > 0 ? 'ready' : 'idle',
        activeSheetId: next.sheetLayouts.some((sheet) => sheet.id === state.activeSheetId)
          ? state.activeSheetId
          : next.sheetLayouts[0]?.id,
      };
    }),
});
