import type { AppSliceCreator, HistorySlice } from '../types';

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
      };
    }),
});
