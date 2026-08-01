import type { AppSliceCreator, ViewportSlice } from '../types';
import { completedStepsBefore } from '../workflow';
import { setCopyLocale } from '../../locales';

const loadInitialLocale = () => {
  try {
    const locale = window.localStorage.getItem('slicefold-locale') === 'he' ? 'he' : 'en';
    setCopyLocale(locale);
    return locale;
  } catch {
    return 'en' as const;
  }
};

export const createViewportSlice: AppSliceCreator<ViewportSlice> = (set) => ({
  locale: loadInitialLocale(),
  viewportMode: 'three',
  cameraPreset: 'isometric',
  cameraResetToken: 0,
  activeWorkflowStep: 'start',
  completedWorkflowSteps: [],
  foldPreviewProgress: 0,
  setViewportMode: (viewportMode) => set({ viewportMode }),
  setLocale: (locale) => {
    setCopyLocale(locale);
    try {
      window.localStorage.setItem('slicefold-locale', locale);
    } catch {
      // Language still changes for this session when browser storage is unavailable.
    }
    set({ locale });
  },
  setCameraPreset: (cameraPreset) => set({ cameraPreset }),
  fitCamera: () => set((state) => ({ cameraResetToken: state.cameraResetToken + 1 })),
  setActiveWorkflowStep: (activeWorkflowStep) => set({ activeWorkflowStep }),
  completeWorkflowStep: (step) =>
    set((state) => ({
      completedWorkflowSteps: state.completedWorkflowSteps.includes(step)
        ? state.completedWorkflowSteps
        : [...state.completedWorkflowSteps, step],
    })),
  invalidateWorkflowFrom: (step) =>
    set((state) => ({
      completedWorkflowSteps: completedStepsBefore(state.completedWorkflowSteps, step),
    })),
  setFoldPreviewProgress: (progress) =>
    set({
      foldPreviewProgress: Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)),
    }),
});
