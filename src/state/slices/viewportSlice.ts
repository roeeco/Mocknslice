import type { AppSliceCreator, ExperienceMode, ViewportSlice } from '../types';
import { completedStepsBefore, visibleWorkflowSteps } from '../workflow';
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

const loadExperienceMode = (): ExperienceMode => {
  try {
    return window.localStorage.getItem('mocknslice-experience-mode') === 'advanced'
      ? 'advanced'
      : 'standard';
  } catch {
    return 'standard';
  }
};

export const createViewportSlice: AppSliceCreator<ViewportSlice> = (set) => ({
  locale: loadInitialLocale(),
  experienceMode: loadExperienceMode(),
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
  setExperienceMode: (experienceMode) =>
    set((state) => {
      try {
        window.localStorage.setItem('mocknslice-experience-mode', experienceMode);
      } catch {
        // The preference still applies for this session when storage is unavailable.
      }
      const steps = visibleWorkflowSteps(
        state.project,
        experienceMode,
        state.sliceGenerationStatus,
      );
      const activeWorkflowStep = steps.includes(state.activeWorkflowStep)
        ? state.activeWorkflowStep
        : state.activeWorkflowStep === 'import'
          ? 'configure'
          : 'export';
      return {
        experienceMode,
        activeWorkflowStep,
        completedWorkflowSteps: state.completedWorkflowSteps,
        viewportMode:
          activeWorkflowStep === 'export' || activeWorkflowStep === 'arrange'
            ? 'two'
            : state.viewportMode,
      };
    }),
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
      completedWorkflowSteps: completedStepsBefore(
        state.completedWorkflowSteps,
        step,
        visibleWorkflowSteps(state.project, state.experienceMode, state.sliceGenerationStatus),
      ),
    })),
  setFoldPreviewProgress: (progress) =>
    set({
      foldPreviewProgress: Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0)),
    }),
});
