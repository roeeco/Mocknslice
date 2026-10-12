import { cancelPapercraftTask } from './papercraftSlice';
import type { AppSliceCreator, AppState, FabricationSlice } from '../types';
import { recordProjectChange, touchProject } from '../projectChange';
import { validationIssuesForProject } from '../../validation/projectValidation';
import {
  generateFoldTemplateInWorker,
  generateMeshUnfoldInWorker,
  generatePanelConstructionInWorker,
  generateStackedSlicesInWorker,
  generateWaffleSlicesInWorker,
  type GeometryTask,
} from '../../workers/geometryWorkerClient';
import { TEMPLATE_KINDS, type TemplateKind } from '../../domain/folding';
import type { ProjectData } from '../../domain/project';
import type { WaffleSliceResult } from '../../geometry/slicing/types';
import { arrangePartsInRows } from '../../geometry/layout/arrangeParts';
import { preservePlacements } from '../../geometry/layout/preservePlacements';
import { expectedGenerationSignature, hashSerializable } from '../../domain/generation';
import { runtimeFailure } from '../../domain/runtimeFailure';
import {
  buildCanonicalGenerationInput,
  canonicalGenerationInputHash,
  generationInputChanged,
  type CanonicalGenerationInput,
} from '../../domain/generationInputs';
import type { ModeSettingsByMode } from '../../domain/modeSettings';
import {
  classroomRecipeSettingsArePristine,
  resolveClassroomRecipeSettings,
} from '../../domain/classroomRecipes';
import {
  clampPanelThickness,
  DEFAULT_PANEL_PROFILES,
  maximumPanelDividerCount,
} from '../../domain/panelConstruction';
import type { PanelComposerSettings } from '../../domain/modeSettings';

function updatedPanelSettings(
  current: PanelComposerSettings,
  patch: Partial<PanelComposerSettings>,
): PanelComposerSettings {
  const next = { ...current, ...patch };
  next.panelThicknessMm = clampPanelThickness(next.panelThicknessMm);
  next.dividerThicknessMm = clampPanelThickness(next.dividerThicknessMm);
  next.lidThicknessMm = clampPanelThickness(next.lidThicknessMm);
  next.widthDividerCount = Math.min(
    Math.max(0, Math.round(next.widthDividerCount)),
    maximumPanelDividerCount(next.innerDepthMm, next.dividerThicknessMm),
  );
  next.depthDividerCount = Math.min(
    Math.max(0, Math.round(next.depthDividerCount)),
    maximumPanelDividerCount(next.innerWidthMm, next.dividerThicknessMm),
  );
  next.connectionOverrides = structuredClone(next.connectionOverrides ?? {});
  next.panelProfiles = structuredClone(next.panelProfiles ?? DEFAULT_PANEL_PROFILES);
  return next;
}

function generationRecordFor(project: ProjectData, result: unknown, algorithmVersion: string) {
  return {
    ...expectedGenerationSignature(project),
    resultHash: hashSerializable(result),
    algorithmVersion,
    generatedAt: new Date().toISOString(),
  };
}

type GenerationInputForMode<M extends CanonicalGenerationInput['mode']> = Extract<
  CanonicalGenerationInput,
  { mode: M }
>;

function generationInputForMode<M extends CanonicalGenerationInput['mode']>(
  project: ProjectData,
  mode: M,
): GenerationInputForMode<M> {
  const input = buildCanonicalGenerationInput(project);
  if (input.mode !== mode) throw new Error(`Expected ${mode} generation input.`);
  return input as GenerationInputForMode<M>;
}

function generationInputStillMatches(
  project: ProjectData,
  dispatched: CanonicalGenerationInput,
): boolean {
  try {
    const current = buildCanonicalGenerationInput(project);
    return (
      current.mode === dispatched.mode &&
      canonicalGenerationInputHash(current) === canonicalGenerationInputHash(dispatched)
    );
  } catch {
    return false;
  }
}

let activeTask: Pick<GeometryTask<unknown>, 'cancel'> | undefined;
const templateKinds = new Set<TemplateKind>(TEMPLATE_KINDS);

function withTemplateSource(project: ProjectData, templateKind: TemplateKind): ProjectData {
  const alreadyCreating = project.fabricationMode === 'fold-template';
  const current = project.modeSettings.foldTemplate;
  return touchProject({
    ...project,
    fabricationMode: 'fold-template',
    modeSettings: {
      ...project.modeSettings,
      foldTemplate: {
        ...current,
        templateKind,
        widthMm: alreadyCreating && current.widthMm > 0 ? current.widthMm : 80,
        lengthMm: alreadyCreating && current.lengthMm > 0 ? current.lengthMm : 60,
        heightMm: alreadyCreating && current.heightMm > 0 ? current.heightMm : 40,
      },
    },
  });
}

function settingsChange(
  state: AppState,
  update: (settings: ModeSettingsByMode) => ModeSettingsByMode,
) {
  const changed = recordProjectChange(state, (project) =>
    touchProject({ ...project, modeSettings: update(project.modeSettings) }),
  );
  const nextProject = changed.project ?? state.project;
  const activeInputChanged = generationInputChanged(state.project, nextProject);
  return {
    ...changed,
    sliceGenerationStatus:
      state.project.generatedParts.length > 0 && activeInputChanged
        ? ('stale' as const)
        : state.sliceGenerationStatus,
    sliceGenerationError: activeInputChanged ? undefined : state.sliceGenerationError,
    validationIssues: validationIssuesForProject(nextProject),
    completedWorkflowSteps: activeInputChanged
      ? state.completedWorkflowSteps.filter((step) => ['start', 'mode', 'import'].includes(step))
      : state.completedWorkflowSteps,
  };
}

export const createFabricationSlice: AppSliceCreator<FabricationSlice> = (set, get) => ({
  sliceGenerationStatus: 'idle',
  sliceGenerationError: undefined,
  setFabricationMode: (fabricationMode) =>
    set((state) => ({
      ...recordProjectChange(state, (project) => touchProject({ ...project, fabricationMode })),
      sliceGenerationStatus:
        state.project.generatedParts.length > 0 ? 'stale' : state.sliceGenerationStatus,
      completedWorkflowSteps: state.completedWorkflowSteps.filter((step) => step === 'start'),
    })),
  setWorkflowSourceMode: (workflowSourceMode) =>
    set((state) => ({
      ...recordProjectChange(state, (project) =>
        workflowSourceMode === 'template'
          ? withTemplateSource(
              project,
              templateKinds.has(project.modeSettings.foldTemplate.templateKind)
                ? project.modeSettings.foldTemplate.templateKind
                : 'open-box',
            )
          : touchProject({
              ...project,
              fabricationMode: 'mesh-unfold',
            }),
      ),
      sliceGenerationStatus:
        state.project.generatedParts.length > 0 ? 'stale' : state.sliceGenerationStatus,
      sliceGenerationError: undefined,
      completedWorkflowSteps: state.completedWorkflowSteps.filter((step) =>
        ['start', 'mode'].includes(step),
      ),
    })),
  selectTemplateSource: (templateKind) =>
    set((state) => ({
      ...recordProjectChange(state, (project) => withTemplateSource(project, templateKind)),
      sliceGenerationStatus:
        state.project.generatedParts.length > 0 ? 'stale' : state.sliceGenerationStatus,
      sliceGenerationError: undefined,
      completedWorkflowSteps: state.completedWorkflowSteps.filter((step) =>
        ['start', 'mode'].includes(step),
      ),
    })),
  updateStackedSliceSettings: (patch) =>
    set((state) =>
      settingsChange(state, (settings) => ({
        ...settings,
        stackedSlices: { ...settings.stackedSlices, ...patch },
      })),
    ),
  updateWaffleSliceSettings: (patch) =>
    set((state) =>
      settingsChange(state, (settings) => ({
        ...settings,
        waffleSlices: { ...settings.waffleSlices, ...patch },
      })),
    ),
  updateFoldTemplateSettings: (patch) =>
    set((state) =>
      settingsChange(state, (settings) => ({
        ...settings,
        foldTemplate: { ...settings.foldTemplate, ...patch },
      })),
    ),
  updateMeshUnfoldSettings: (patch) =>
    set((state) =>
      settingsChange(state, (settings) => ({
        ...settings,
        meshUnfold: { ...settings.meshUnfold, ...patch },
      })),
    ),
  updatePanelComposerSettings: (patch) =>
    set((state) =>
      settingsChange(state, (settings) => ({
        ...settings,
        panelConstruction: updatedPanelSettings(settings.panelConstruction, patch),
      })),
    ),
  replacePanelComposerSettings: (panelConstruction) =>
    set((state) => settingsChange(state, (settings) => ({ ...settings, panelConstruction }))),
  applyPanelRecipe: (id) =>
    set((state) => {
      const material = state.project.materialProfileSnapshot;
      const current = state.project.modeSettings.panelConstruction;
      const next = resolveClassroomRecipeSettings(id, material);
      if (current.recipe?.id === id && classroomRecipeSettingsArePristine(current, material)) {
        return state;
      }
      return settingsChange(state, (modeSettings) => ({
        ...modeSettings,
        panelConstruction: next,
      }));
    }),
  addPanelFeature: (feature) =>
    set((state) =>
      settingsChange(state, (modeSettings) => ({
        ...modeSettings,
        panelConstruction: {
          ...modeSettings.panelConstruction,
          features: [...modeSettings.panelConstruction.features, feature].sort((left, right) =>
            left.id.localeCompare(right.id),
          ),
        },
      })),
    ),
  updatePanelFeature: (id, feature) =>
    set((state) =>
      settingsChange(state, (modeSettings) => ({
        ...modeSettings,
        panelConstruction: {
          ...modeSettings.panelConstruction,
          features: modeSettings.panelConstruction.features
            .map((candidate) => (candidate.id === id ? feature : candidate))
            .sort((left, right) => left.id.localeCompare(right.id)),
        },
      })),
    ),
  duplicatePanelFeature: (id, newId) =>
    set((state) =>
      settingsChange(state, (modeSettings) => {
        const source = modeSettings.panelConstruction.features.find(
          (candidate) => candidate.id === id,
        );
        if (!source) return modeSettings;
        const duplicate = {
          ...structuredClone(source),
          id: newId,
          offsetMm: {
            x: (source.offsetMm?.x ?? 0) + 5,
            y: (source.offsetMm?.y ?? 0) - 5,
          },
        };
        return {
          ...modeSettings,
          panelConstruction: {
            ...modeSettings.panelConstruction,
            features: [...modeSettings.panelConstruction.features, duplicate].sort((left, right) =>
              left.id.localeCompare(right.id),
            ),
          },
        };
      }),
    ),
  removePanelFeature: (id) =>
    set((state) =>
      settingsChange(state, (modeSettings) => ({
        ...modeSettings,
        panelConstruction: {
          ...modeSettings.panelConstruction,
          features: modeSettings.panelConstruction.features.filter((feature) => feature.id !== id),
        },
      })),
    ),
  generateSlices: () => {
    const { project } = get();
    let input: GenerationInputForMode<'stacked-slices'>;
    try {
      input = generationInputForMode(project, 'stacked-slices');
    } catch (error) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure(
          project.model.mesh && project.model.bounds
            ? 'SLICE_GENERATION_FAILED'
            : 'MODEL_MESH_MISSING',
          error instanceof Error ? error.message : undefined,
        ),
      });
      return;
    }
    activeTask?.cancel();
    cancelPapercraftTask();
    const task = generateStackedSlicesInWorker(input.payload);
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result) => {
        set((state) => {
          if (!generationInputStillMatches(state.project, input)) {
            return {
              sliceGenerationStatus: 'stale',
              sliceGenerationError: runtimeFailure('GENERATION_INPUT_CHANGED'),
            };
          }
          const changed = recordProjectChange(state, (currentProject) => {
            const template = currentProject.sheetLayouts[0];
            return touchProject({
              ...currentProject,
              generatedParts: result.parts,
              generationIssues: result.issues,
              generationRecord: generationRecordFor(currentProject, result, 'sf9-stacked-slices'),
              foldingResult: undefined,
              unfoldingResult: undefined,
              panelConstructionResult: undefined,
              sheetLayouts: template
                ? arrangePartsInRows(result.parts, template)
                : currentProject.sheetLayouts,
            });
          });
          const nextProject = changed.project ?? state.project;
          return {
            ...changed,
            sliceGenerationStatus: result.parts.length > 0 ? 'ready' : 'error',
            sliceGenerationError:
              result.parts.length > 0
                ? undefined
                : runtimeFailure(
                    'SLICE_GENERATION_FAILED',
                    result.issues.find((issue) => issue.severity === 'error')?.message,
                  ),
            validationIssues: validationIssuesForProject(nextProject),
            selectedEntityId: result.parts[0]?.id,
            selectedPartId: result.parts[0]?.id,
            activeSheetId: nextProject.sheetLayouts[0]?.id,
            activeWorkflowStep: state.activeWorkflowStep,
            completedWorkflowSteps: state.completedWorkflowSteps,
            viewportMode: state.viewportMode,
          };
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        set({
          sliceGenerationStatus: 'error',
          sliceGenerationError: runtimeFailure(
            'SLICE_GENERATION_FAILED',
            error instanceof Error ? error.message : undefined,
          ),
        });
      })
      .finally(() => {
        if (activeTask === task) activeTask = undefined;
      });
  },
  generateWaffleSlices: () => {
    const { project } = get();
    let input: GenerationInputForMode<'waffle-slices'>;
    try {
      input = generationInputForMode(project, 'waffle-slices');
    } catch (error) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure(
          project.model.mesh && project.model.bounds
            ? 'WAFFLE_GENERATION_FAILED'
            : 'MODEL_MESH_MISSING',
          error instanceof Error ? error.message : undefined,
        ),
      });
      return;
    }
    if (input.payload.settings.primaryAxis === input.payload.settings.secondaryAxis) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure('WAFFLE_AXES_MATCH'),
      });
      return;
    }
    activeTask?.cancel();
    cancelPapercraftTask();
    const task = generateWaffleSlicesInWorker(input.payload);
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result: WaffleSliceResult) => {
        set((state) => {
          if (!generationInputStillMatches(state.project, input)) {
            return {
              sliceGenerationStatus: 'stale',
              sliceGenerationError: runtimeFailure('GENERATION_INPUT_CHANGED'),
            };
          }
          const changed = recordProjectChange(state, (currentProject) => {
            const template = currentProject.sheetLayouts[0];
            return touchProject({
              ...currentProject,
              generatedParts: result.parts,
              generationIssues: result.issues,
              generationRecord: generationRecordFor(currentProject, result, 'sf9-waffle-slices'),
              foldingResult: undefined,
              unfoldingResult: undefined,
              panelConstructionResult: undefined,
              sheetLayouts: template
                ? arrangePartsInRows(result.parts, template)
                : currentProject.sheetLayouts,
            });
          });
          const nextProject = changed.project ?? state.project;
          return {
            ...changed,
            sliceGenerationStatus: 'ready',
            sliceGenerationError: undefined,
            validationIssues: validationIssuesForProject(nextProject),
            selectedEntityId: result.parts[0]?.id,
            selectedPartId: result.parts[0]?.id,
            activeSheetId: nextProject.sheetLayouts[0]?.id,
            activeWorkflowStep: state.activeWorkflowStep,
            completedWorkflowSteps: state.completedWorkflowSteps,
            viewportMode: state.viewportMode,
          };
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        set({
          sliceGenerationStatus: 'error',
          sliceGenerationError: runtimeFailure(
            'WAFFLE_GENERATION_FAILED',
            error instanceof Error ? error.message : undefined,
          ),
        });
      })
      .finally(() => {
        if (activeTask === task) activeTask = undefined;
      });
  },
  generateFoldTemplate: (options) => {
    const { project } = get();
    const inputHistory = get().past.at(-1);
    let input: GenerationInputForMode<'fold-template'>;
    try {
      input = generationInputForMode(project, 'fold-template');
    } catch (error) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure(
          'FOLD_GENERATION_FAILED',
          error instanceof Error ? error.message : undefined,
        ),
      });
      return;
    }
    activeTask?.cancel();
    cancelPapercraftTask();
    const task = generateFoldTemplateInWorker(input.payload);
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result) => {
        set((state) => {
          if (!generationInputStillMatches(state.project, input)) {
            return {
              sliceGenerationStatus: 'stale',
              sliceGenerationError: runtimeFailure('GENERATION_INPUT_CHANGED'),
            };
          }
          const blockingIssue = result.issues.find((issue) => issue.severity === 'error');
          if (blockingIssue) {
            return {
              sliceGenerationStatus: 'error',
              sliceGenerationError: runtimeFailure('FOLD_GENERATION_FAILED', blockingIssue.message),
            };
          }
          const applyResult = (currentProject: ProjectData) => {
            const template = currentProject.sheetLayouts[0];
            return touchProject({
              ...currentProject,
              generatedParts: result.parts,
              generationIssues: result.issues,
              generationRecord: generationRecordFor(
                currentProject,
                result,
                result.algorithmVersion,
              ),
              foldingResult: result,
              unfoldingResult: undefined,
              panelConstructionResult: undefined,
              sheetLayouts: template
                ? options?.mergeWithInputEdit
                  ? preservePlacements(
                      currentProject.sheetLayouts,
                      currentProject.generatedParts,
                      result.parts,
                    )
                  : arrangePartsInRows(result.parts, template)
                : currentProject.sheetLayouts,
            });
          };
          const changed =
            options?.mergeWithInputEdit && inputHistory && state.past.at(-1) === inputHistory
              ? { project: applyResult(state.project), autosaveStatus: 'pending' as const }
              : recordProjectChange(state, applyResult);
          const nextProject = changed.project ?? state.project;
          const generationSucceeded = result.parts.length > 0;
          const retainedEdge = result.editableEdges?.find(
            (edge) => edge.id === state.selectedEntityId,
          );
          return {
            ...changed,
            sliceGenerationStatus: generationSucceeded ? 'ready' : 'error',
            sliceGenerationError: generationSucceeded
              ? undefined
              : runtimeFailure(
                  'FOLD_GENERATION_FAILED',
                  result.issues.find((issue) => issue.severity === 'error')?.message,
                ),
            validationIssues: validationIssuesForProject(nextProject),
            selectedEntityId: retainedEdge?.id ?? result.panels[0]?.id ?? result.parts[0]?.id,
            selectedPartId:
              (retainedEdge
                ? result.panels.find((panel) => panel.id === retainedEdge.panelAId)?.partId
                : undefined) ??
              result.panels[0]?.partId ??
              result.parts[0]?.id,
            activeSheetId: nextProject.sheetLayouts[0]?.id,
            activeWorkflowStep: state.activeWorkflowStep,
            completedWorkflowSteps: state.completedWorkflowSteps,
            viewportMode: state.viewportMode,
          };
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        set({
          sliceGenerationStatus: 'error',
          sliceGenerationError: runtimeFailure(
            'FOLD_GENERATION_FAILED',
            error instanceof Error ? error.message : undefined,
          ),
        });
      })
      .finally(() => {
        if (activeTask === task) activeTask = undefined;
      });
  },
  generateMeshUnfold: () => {
    if (get().project.papercraft) {
      get().generatePapercraft();
      return;
    }
    const { project } = get();
    let input: GenerationInputForMode<'mesh-unfold'>;
    try {
      input = generationInputForMode(project, 'mesh-unfold');
    } catch (error) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure(
          project.model.mesh ? 'UNFOLD_GENERATION_FAILED' : 'MODEL_MESH_MISSING',
          error instanceof Error ? error.message : undefined,
        ),
      });
      return;
    }
    activeTask?.cancel();
    cancelPapercraftTask();
    const task = generateMeshUnfoldInWorker(input.payload);
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result) => {
        set((state) => {
          if (!generationInputStillMatches(state.project, input)) {
            return {
              sliceGenerationStatus: 'stale',
              sliceGenerationError: runtimeFailure('GENERATION_INPUT_CHANGED'),
            };
          }
          const changed = recordProjectChange(state, (currentProject) => {
            const template = currentProject.sheetLayouts[0];
            return touchProject({
              ...currentProject,
              generatedParts: result.parts,
              generationIssues: result.issues,
              generationRecord: generationRecordFor(
                currentProject,
                result,
                result.algorithmVersion,
              ),
              foldingResult: undefined,
              unfoldingResult: result,
              panelConstructionResult: undefined,
              sheetLayouts: template
                ? arrangePartsInRows(result.parts, template)
                : currentProject.sheetLayouts,
            });
          });
          const nextProject = changed.project ?? state.project;
          return {
            ...changed,
            sliceGenerationStatus: result.parts.length > 0 ? 'ready' : 'error',
            sliceGenerationError:
              result.parts.length > 0
                ? undefined
                : runtimeFailure(
                    'UNFOLD_GENERATION_FAILED',
                    result.issues.find((issue) => issue.severity === 'error')?.message,
                  ),
            validationIssues: validationIssuesForProject(nextProject),
            selectedEntityId: result.faces[0]?.id ?? result.parts[0]?.id,
            selectedPartId: result.faces[0]?.partId ?? result.parts[0]?.id,
            activeSheetId: nextProject.sheetLayouts[0]?.id,
            activeWorkflowStep: state.activeWorkflowStep,
            completedWorkflowSteps: state.completedWorkflowSteps,
            viewportMode: state.viewportMode,
            foldPreviewProgress: 0,
          };
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        set({
          sliceGenerationStatus: 'error',
          sliceGenerationError: runtimeFailure(
            'UNFOLD_GENERATION_FAILED',
            error instanceof Error ? error.message : undefined,
          ),
        });
      })
      .finally(() => {
        if (activeTask === task) activeTask = undefined;
      });
  },
  generatePanelConstruction: () => {
    const { project } = get();
    let input: GenerationInputForMode<'panel-construction'>;
    try {
      input = generationInputForMode(project, 'panel-construction');
    } catch (error) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure(
          'PANEL_GENERATION_FAILED',
          error instanceof Error ? error.message : undefined,
        ),
      });
      return;
    }
    activeTask?.cancel();
    cancelPapercraftTask();
    const task = generatePanelConstructionInWorker(input.payload);
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result) => {
        set((state) => {
          if (!generationInputStillMatches(state.project, input)) {
            return {
              sliceGenerationStatus: 'stale',
              sliceGenerationError: runtimeFailure('GENERATION_INPUT_CHANGED'),
            };
          }
          const blockingIssue = result.issues.find((issue) => issue.severity === 'error');
          if (blockingIssue) {
            return {
              sliceGenerationStatus: 'error',
              sliceGenerationError: runtimeFailure(
                'PANEL_GENERATION_FAILED',
                blockingIssue.message,
              ),
            };
          }
          const changed = recordProjectChange(state, (currentProject) => {
            const template = currentProject.sheetLayouts[0];
            return touchProject({
              ...currentProject,
              generatedParts: result.parts,
              generationIssues: result.issues,
              generationRecord: generationRecordFor(
                currentProject,
                result,
                result.algorithmVersion,
              ),
              foldingResult: undefined,
              unfoldingResult: undefined,
              panelConstructionResult: result,
              sheetLayouts: template
                ? arrangePartsInRows(result.parts, template)
                : currentProject.sheetLayouts,
            });
          });
          const nextProject = changed.project ?? state.project;
          const retainedEdge = result.editableEdges?.find(
            (edge) => edge.id === state.selectedEntityId,
          );
          return {
            ...changed,
            sliceGenerationStatus: result.parts.length > 0 ? 'ready' : 'error',
            sliceGenerationError:
              result.parts.length > 0
                ? undefined
                : runtimeFailure(
                    'PANEL_GENERATION_FAILED',
                    result.issues.find((issue) => issue.severity === 'error')?.message,
                  ),
            validationIssues: validationIssuesForProject(nextProject),
            selectedEntityId: retainedEdge?.id ?? result.panels[0]?.id ?? result.parts[0]?.id,
            selectedPartId:
              (retainedEdge
                ? result.panels.find((panel) => panel.id === retainedEdge.panelAId)?.partId
                : undefined) ??
              result.panels[0]?.partId ??
              result.parts[0]?.id,
            activeSheetId: nextProject.sheetLayouts[0]?.id,
            activeWorkflowStep: state.activeWorkflowStep,
            completedWorkflowSteps: state.completedWorkflowSteps,
            viewportMode: state.viewportMode,
          };
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        set({
          sliceGenerationStatus: 'error',
          sliceGenerationError: runtimeFailure(
            'PANEL_GENERATION_FAILED',
            error instanceof Error ? error.message : undefined,
          ),
        });
      })
      .finally(() => {
        if (activeTask === task) activeTask = undefined;
      });
  },
  cancelSliceGeneration: () => {
    activeTask?.cancel();
    cancelPapercraftTask();
    activeTask = undefined;
    set({
      sliceGenerationStatus: 'cancelled',
      sliceGenerationError: runtimeFailure('GENERATION_CANCELLED'),
    });
  },
});
