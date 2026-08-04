import type { AppSliceCreator, FabricationSlice } from '../types';
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
import type { SliceAxis } from '../../domain/fabrication';
import type {
  TemplateEnvelopeDimensions,
  TemplateFitSettings,
  TemplateKind,
  TemplateSizeMode,
} from '../../domain/folding';
import { TEMPLATE_KINDS } from '../../domain/folding';
import type { MeshUnfoldSettings, MeshUnfoldStrategy } from '../../domain/unfolding';
import type {
  PanelConstructionMaterial,
  PanelConstructionSettings,
  PanelJointKind,
} from '../../domain/panelConstruction';
import type { ProjectData } from '../../domain/project';
import type {
  StackedSliceSettings,
  WaffleSliceResult,
  WaffleSliceSettings,
  WaffleSlotPattern,
} from '../../geometry/slicing/types';
import { arrangePartsInRows } from '../../geometry/layout/arrangeParts';
import { expectedGenerationSignature, hashSerializable } from '../../domain/generation';
import type { ExperienceMode } from '../types';
import { runtimeFailure } from '../../domain/runtimeFailure';

function generationRecordFor(project: ProjectData, result: unknown, algorithmVersion: string) {
  return {
    ...expectedGenerationSignature(project),
    resultHash: hashSerializable(result),
    algorithmVersion,
    generatedAt: new Date().toISOString(),
  };
}

let activeTask: Pick<GeometryTask<unknown>, 'cancel'> | undefined;

function positiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function settingsForProject(project: ProjectData): StackedSliceSettings {
  return {
    axis: (project.modeParameters.sliceAxis as SliceAxis | undefined) ?? 'z',
    spacingMm: positiveNumber(project.modeParameters.spacingMm, 10),
    thicknessMm: positiveNumber(
      project.modeParameters.sliceThicknessMm,
      project.materialProfileSnapshot.thicknessMm,
    ),
    contourEpsilonMm: positiveNumber(project.modeParameters.contourEpsilonMm, 0.001),
  };
}

function settingsMatch(a: StackedSliceSettings, b: StackedSliceSettings): boolean {
  return (
    a.axis === b.axis &&
    a.spacingMm === b.spacingMm &&
    a.thicknessMm === b.thicknessMm &&
    a.contourEpsilonMm === b.contourEpsilonMm
  );
}

function waffleSettingsForProject(project: ProjectData): WaffleSliceSettings {
  return {
    primaryAxis: (project.modeParameters.wafflePrimaryAxis as SliceAxis | undefined) ?? 'x',
    secondaryAxis: (project.modeParameters.waffleSecondaryAxis as SliceAxis | undefined) ?? 'y',
    primarySpacingMm: positiveNumber(project.modeParameters.wafflePrimarySpacingMm, 20),
    secondarySpacingMm: positiveNumber(project.modeParameters.waffleSecondarySpacingMm, 20),
    thicknessMm: positiveNumber(
      project.modeParameters.waffleThicknessMm,
      project.materialProfileSnapshot.thicknessMm,
    ),
    clearanceMm: nonNegativeNumber(
      project.modeParameters.waffleClearanceMm,
      project.materialProfileSnapshot.clearanceMm,
    ),
    contourEpsilonMm: positiveNumber(project.modeParameters.contourEpsilonMm, 0.001),
    slotPattern:
      (project.modeParameters.waffleSlotPattern as WaffleSlotPattern | undefined) ?? 'alternating',
    reverseSlots: Boolean(project.modeParameters.waffleReverseSlots),
  };
}

function waffleSettingsMatch(a: WaffleSliceSettings, b: WaffleSliceSettings): boolean {
  return (
    a.primaryAxis === b.primaryAxis &&
    a.secondaryAxis === b.secondaryAxis &&
    a.primarySpacingMm === b.primarySpacingMm &&
    a.secondarySpacingMm === b.secondarySpacingMm &&
    a.thicknessMm === b.thicknessMm &&
    a.clearanceMm === b.clearanceMm &&
    a.contourEpsilonMm === b.contourEpsilonMm &&
    a.slotPattern === b.slotPattern &&
    a.reverseSlots === b.reverseSlots
  );
}

const templateKinds = new Set<TemplateKind>(TEMPLATE_KINDS);

function withTemplateSource(project: ProjectData, templateKind: TemplateKind): ProjectData {
  const alreadyCreating = project.modeParameters.workflowSourceMode === 'template';
  return touchProject({
    ...project,
    fabricationMode: 'fold-template',
    modeParameters: {
      ...project.modeParameters,
      workflowSourceMode: 'template',
      foldTemplateKind: templateKind,
      foldSizeMode: 'custom',
      foldStandalone: true,
      foldFitAxis: 'y',
      foldClearanceMm: 0,
      foldWidthMm: alreadyCreating ? positiveNumber(project.modeParameters.foldWidthMm, 80) : 80,
      foldLengthMm: alreadyCreating ? positiveNumber(project.modeParameters.foldLengthMm, 60) : 60,
      foldHeightMm: alreadyCreating ? positiveNumber(project.modeParameters.foldHeightMm, 40) : 40,
    },
  });
}

function foldSettingsForProject(project: ProjectData): TemplateFitSettings {
  const rawKind = project.modeParameters.foldTemplateKind;
  const templateKind =
    typeof rawKind === 'string' && templateKinds.has(rawKind as TemplateKind)
      ? (rawKind as TemplateKind)
      : 'open-box';
  const rawAxis = project.modeParameters.foldFitAxis;
  const fitAxis: SliceAxis =
    project.fabricationMode === 'fold-template'
      ? 'y'
      : rawAxis === 'x' || rawAxis === 'y' || rawAxis === 'z'
        ? rawAxis
        : 'z';
  const sizeMode: TemplateSizeMode =
    project.fabricationMode === 'fold-template' || project.modeParameters.foldSizeMode === 'custom'
      ? 'custom'
      : 'auto-fit';
  const envelopeDimensions: TemplateEnvelopeDimensions | undefined =
    sizeMode === 'custom'
      ? {
          widthMm: positiveNumber(
            project.modeParameters.foldWidthMm,
            project.model.dimensions.widthMm,
          ),
          lengthMm: positiveNumber(
            project.modeParameters.foldLengthMm,
            project.model.dimensions.depthMm,
          ),
          heightMm: positiveNumber(
            project.modeParameters.foldHeightMm,
            project.model.dimensions.heightMm,
          ),
        }
      : undefined;
  return {
    templateKind,
    fitAxis,
    clearanceMm: nonNegativeNumber(
      project.modeParameters.foldClearanceMm,
      project.materialProfileSnapshot.clearanceMm,
    ),
    profileToleranceMm: positiveNumber(project.modeParameters.foldProfileToleranceMm, 1),
    sizeMode,
    ...(envelopeDimensions ? { envelopeDimensions } : {}),
    parameters: {
      wallHeightMm: positiveNumber(project.modeParameters.foldWallHeightMm, 20),
      tabDepthMm: positiveNumber(project.modeParameters.foldTabDepthMm, 8),
      lidDepthMm: positiveNumber(project.modeParameters.foldLidDepthMm, 15),
      lidClearanceMm: nonNegativeNumber(project.modeParameters.foldLidClearanceMm, 0.5),
      gussetDepthMm: positiveNumber(project.modeParameters.foldGussetDepthMm, 20),
      closureFlapMm: nonNegativeNumber(project.modeParameters.foldClosureFlapMm, 12),
      prismSides: Math.round(positiveNumber(project.modeParameters.foldPrismSides, 6)),
      prismRotationDeg:
        typeof project.modeParameters.foldPrismRotationDeg === 'number'
          ? project.modeParameters.foldPrismRotationDeg
          : 0,
      topScale: nonNegativeNumber(project.modeParameters.foldTopScale, 0),
      seamTabMm: positiveNumber(project.modeParameters.foldSeamTabMm, 8),
      standalone: project.fabricationMode === 'fold-template',
      closureMethod:
        project.modeParameters.foldClosureMethod === 'press-fit' ? 'press-fit' : 'glue',
      slotClearanceMm: nonNegativeNumber(
        project.modeParameters.foldSlotClearanceMm,
        project.materialProfileSnapshot.clearanceMm,
      ),
    },
  };
}

function foldSettingsMatch(a: TemplateFitSettings, b: TemplateFitSettings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
    ? Math.round(value)
    : fallback;
}

function unfoldSettingsForProject(
  project: ProjectData,
  experienceMode: ExperienceMode,
): MeshUnfoldSettings {
  if (experienceMode === 'standard') {
    return {
      strategy: 'automatic',
      rootFaceIndex: 0,
      manualSeamKeys: [],
      tabDepthMm: 6,
      maximumFaceCount: 200,
      searchAttempts: 18,
    };
  }
  const rawStrategy = project.modeParameters.meshUnfoldStrategy;
  const strategy: MeshUnfoldStrategy = rawStrategy === 'manual' ? 'manual' : 'automatic';
  const rawSeams = project.modeParameters.meshUnfoldSeams;
  const manualSeamKeys =
    typeof rawSeams === 'string'
      ? [
          ...new Set(
            rawSeams
              .split(',')
              .map((key) => key.trim())
              .filter(Boolean),
          ),
        ].sort()
      : [];
  const rawRoot = project.modeParameters.meshUnfoldRootFace;
  return {
    strategy,
    rootFaceIndex:
      typeof rawRoot === 'number' && Number.isFinite(rawRoot)
        ? Math.max(0, Math.round(rawRoot))
        : 0,
    manualSeamKeys,
    tabDepthMm: positiveNumber(project.modeParameters.meshUnfoldTabDepthMm, 6),
    maximumFaceCount: positiveInteger(project.modeParameters.meshUnfoldMaximumFaces, 200),
    searchAttempts: positiveInteger(project.modeParameters.meshUnfoldSearchAttempts, 18),
  };
}

function unfoldSettingsMatch(first: MeshUnfoldSettings, second: MeshUnfoldSettings): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function panelSettingsForProject(project: ProjectData): PanelConstructionSettings {
  const rawJoint = project.modeParameters.panelJointKind;
  const jointKind: PanelJointKind =
    rawJoint === 'butt' || rawJoint === 'tab-slot' ? rawJoint : 'finger';
  const legacyCount = Math.max(
    0,
    Math.min(6, Math.round(nonNegativeNumber(project.modeParameters.panelDividerCount, 0))),
  );
  const hasGridCounts =
    project.modeParameters.panelWidthDividerCount !== undefined ||
    project.modeParameters.panelDepthDividerCount !== undefined;
  const dividerCount = (name: string, legacyFallback: number) =>
    Math.max(
      0,
      Math.min(
        6,
        Math.round(
          nonNegativeNumber(project.modeParameters[name], hasGridCounts ? 0 : legacyFallback),
        ),
      ),
    );
  return {
    innerWidthMm: positiveNumber(project.modeParameters.panelInnerWidthMm, 80),
    innerDepthMm: positiveNumber(project.modeParameters.panelInnerDepthMm, 60),
    innerHeightMm: positiveNumber(project.modeParameters.panelInnerHeightMm, 50),
    jointKind,
    fingerWidthMm: positiveNumber(project.modeParameters.panelFingerWidthMm, 10),
    clearanceMm: nonNegativeNumber(
      project.modeParameters.panelClearanceMm,
      project.materialProfileSnapshot.clearanceMm,
    ),
    includeLid: Boolean(project.modeParameters.panelIncludeLid),
    widthDividerCount: dividerCount(
      'panelWidthDividerCount',
      project.modeParameters.panelDividerAxis === 'depth' ? 0 : legacyCount,
    ),
    depthDividerCount: dividerCount(
      'panelDepthDividerCount',
      project.modeParameters.panelDividerAxis === 'depth' ? legacyCount : 0,
    ),
  };
}

function panelMaterialForProject(project: ProjectData): PanelConstructionMaterial {
  const material = project.materialProfileSnapshot;
  return {
    id: material.id,
    category: material.category,
    thicknessMm: material.thicknessMm,
    kerfMm: material.kerfMm,
  };
}

function panelInputMatches(
  project: ProjectData,
  settings: PanelConstructionSettings,
  material: PanelConstructionMaterial,
): boolean {
  return (
    JSON.stringify(panelSettingsForProject(project)) === JSON.stringify(settings) &&
    JSON.stringify(panelMaterialForProject(project)) === JSON.stringify(material)
  );
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
              templateKinds.has(project.modeParameters.foldTemplateKind as TemplateKind)
                ? (project.modeParameters.foldTemplateKind as TemplateKind)
                : 'open-box',
            )
          : touchProject({
              ...project,
              fabricationMode: 'mesh-unfold',
              modeParameters: {
                ...project.modeParameters,
                workflowSourceMode,
                foldStandalone: false,
              },
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
  setModeParameter: (name, value) =>
    set((state) => ({
      ...recordProjectChange(state, (project) =>
        touchProject({
          ...project,
          modeParameters: { ...project.modeParameters, [name]: value },
        }),
      ),
      sliceGenerationStatus:
        state.project.generatedParts.length > 0 ? 'stale' : state.sliceGenerationStatus,
      sliceGenerationError: undefined,
      completedWorkflowSteps: state.completedWorkflowSteps.filter((step) =>
        ['start', 'mode', 'import'].includes(step),
      ),
    })),
  generateSlices: () => {
    const { project } = get();
    if (!project.model.mesh || !project.model.bounds) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure('MODEL_MESH_MISSING'),
      });
      return;
    }
    activeTask?.cancel();
    const settings = settingsForProject(project);
    const sourceMesh = project.model.mesh;
    const task = generateStackedSlicesInWorker({
      mesh: sourceMesh,
      bounds: project.model.bounds,
      modelId: project.model.id,
      settings,
    });
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result) => {
        set((state) => {
          if (
            state.project.model.id !== project.model.id ||
            state.project.model.mesh !== sourceMesh ||
            state.project.fabricationMode !== 'stacked-slices' ||
            !settingsMatch(settingsForProject(state.project), settings)
          ) {
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
    if (!project.model.mesh || !project.model.bounds) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure('MODEL_MESH_MISSING'),
      });
      return;
    }
    const settings = waffleSettingsForProject(project);
    if (settings.primaryAxis === settings.secondaryAxis) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure('WAFFLE_AXES_MATCH'),
      });
      return;
    }
    activeTask?.cancel();
    const sourceMesh = project.model.mesh;
    const task = generateWaffleSlicesInWorker({
      mesh: sourceMesh,
      bounds: project.model.bounds,
      modelId: project.model.id,
      settings,
    });
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result: WaffleSliceResult) => {
        set((state) => {
          if (
            state.project.model.id !== project.model.id ||
            state.project.model.mesh !== sourceMesh ||
            state.project.fabricationMode !== 'waffle-slices' ||
            !waffleSettingsMatch(waffleSettingsForProject(state.project), settings)
          ) {
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
  generateFoldTemplate: () => {
    const { project } = get();
    if (!project.model.mesh || !project.model.bounds) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure('MODEL_MESH_MISSING'),
      });
      return;
    }
    activeTask?.cancel();
    const settings = foldSettingsForProject(project);
    const sourceMesh = project.model.mesh;
    const task = generateFoldTemplateInWorker({
      mesh: sourceMesh,
      bounds: project.model.bounds,
      modelId: project.model.id,
      materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
      settings,
    });
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result) => {
        set((state) => {
          if (
            state.project.model.id !== project.model.id ||
            state.project.model.mesh !== sourceMesh ||
            state.project.fabricationMode !== 'fold-template' ||
            !foldSettingsMatch(foldSettingsForProject(state.project), settings)
          ) {
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
              foldingResult: result,
              unfoldingResult: undefined,
              panelConstructionResult: undefined,
              sheetLayouts: template
                ? arrangePartsInRows(result.parts, template)
                : currentProject.sheetLayouts,
            });
          });
          const nextProject = changed.project ?? state.project;
          const blockingError = result.issues.some((issue) => issue.severity === 'error');
          const generationSucceeded = result.parts.length > 0 && !blockingError;
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
            selectedEntityId: result.panels[0]?.id ?? result.parts[0]?.id,
            selectedPartId: result.panels[0]?.partId ?? result.parts[0]?.id,
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
    const { project, experienceMode } = get();
    if (!project.model.mesh) {
      set({
        sliceGenerationStatus: 'error',
        sliceGenerationError: runtimeFailure('MODEL_MESH_MISSING'),
      });
      return;
    }
    activeTask?.cancel();
    const settings = unfoldSettingsForProject(project, experienceMode);
    const sourceMesh = project.model.mesh;
    const task = generateMeshUnfoldInWorker({
      mesh: sourceMesh,
      modelId: project.model.id,
      materialThicknessMm: project.materialProfileSnapshot.thicknessMm,
      settings,
    });
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result) => {
        set((state) => {
          if (
            state.project.model.id !== project.model.id ||
            state.project.model.mesh !== sourceMesh ||
            state.project.fabricationMode !== 'mesh-unfold' ||
            !unfoldSettingsMatch(unfoldSettingsForProject(state.project, experienceMode), settings)
          ) {
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
    activeTask?.cancel();
    const settings = panelSettingsForProject(project);
    const material = panelMaterialForProject(project);
    const task = generatePanelConstructionInWorker({
      modelId: project.model.id,
      material,
      settings,
    });
    activeTask = task;
    set({ sliceGenerationStatus: 'processing', sliceGenerationError: undefined });
    void task.promise
      .then((result) => {
        set((state) => {
          if (
            state.project.model.id !== project.model.id ||
            state.project.fabricationMode !== 'panel-construction' ||
            !panelInputMatches(state.project, settings, material)
          ) {
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
              unfoldingResult: undefined,
              panelConstructionResult: result,
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
                    'PANEL_GENERATION_FAILED',
                    result.issues.find((issue) => issue.severity === 'error')?.message,
                  ),
            validationIssues: validationIssuesForProject(nextProject),
            selectedEntityId: result.panels[0]?.id ?? result.parts[0]?.id,
            selectedPartId: result.panels[0]?.partId ?? result.parts[0]?.id,
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
    activeTask = undefined;
    set({
      sliceGenerationStatus: 'cancelled',
      sliceGenerationError: runtimeFailure('GENERATION_CANCELLED'),
    });
  },
});
