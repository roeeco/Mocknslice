import type { ProjectData } from '../domain/project';
import type { ExperienceMode, WorkflowStep } from './types';
import { deriveGenerationState } from '../domain/generation';
import { validateSheetLayouts } from '../geometry/layout/validateSheetLayouts';

export type WorkflowBlockReason =
  | 'PROJECT_NAME_REQUIRED'
  | 'SOURCE_REQUIRED'
  | 'GENERATION_PROCESSING'
  | 'FOLD_DIMENSIONS_INVALID'
  | 'GENERATION_REQUIRED'
  | 'GENERATION_STALE'
  | 'GENERATION_INVALID'
  | 'GENERATION_UNVERIFIED'
  | 'PARTS_UNPLACED'
  | 'LAYOUT_INVALID';

export function deriveWorkflowGate(
  project: ProjectData,
  state: { activeStep: WorkflowStep; generationStatus: string },
): { allowed: boolean; reasons: WorkflowBlockReason[]; suggestedStep?: WorkflowStep } {
  const active = state.activeStep;
  if (active === 'start')
    return project.metadata.name.trim()
      ? { allowed: true, reasons: [] }
      : { allowed: false, reasons: ['PROJECT_NAME_REQUIRED'] };
  if (active === 'mode') return { allowed: true, reasons: [] };
  const importReady =
    project.fabricationMode === 'panel-construction' ||
    project.fabricationMode === 'fold-template' ||
    (project.model.source.kind === 'imported' &&
      Boolean(project.model.mesh && project.model.bounds));
  if (active === 'import')
    return importReady
      ? { allowed: true, reasons: [] }
      : { allowed: false, reasons: ['SOURCE_REQUIRED'] };
  const foldDimensionsValid =
    project.fabricationMode !== 'fold-template' ||
    (project.modeSettings.foldTemplate.widthMm > 0 &&
      project.modeSettings.foldTemplate.lengthMm > 0 &&
      project.modeSettings.foldTemplate.heightMm > 0);
  if (active === 'configure') {
    const reasons: WorkflowBlockReason[] = [];
    if (state.generationStatus === 'processing') reasons.push('GENERATION_PROCESSING');
    if (!foldDimensionsValid) reasons.push('FOLD_DIMENSIONS_INVALID');
    return { allowed: reasons.length === 0, reasons };
  }
  const generation = deriveGenerationState(project);
  if (active === 'inspect') {
    const reason =
      generation === 'ready'
        ? undefined
        : generation === 'absent'
          ? 'GENERATION_REQUIRED'
          : generation === 'stale'
            ? 'GENERATION_STALE'
            : generation === 'invalid'
              ? 'GENERATION_INVALID'
              : 'GENERATION_UNVERIFIED';
    return reason
      ? { allowed: false, reasons: [reason], suggestedStep: 'configure' }
      : { allowed: true, reasons: [] };
  }
  if (active === 'arrange') {
    const placed = new Set(
      project.sheetLayouts.flatMap((sheet) => sheet.placements.map((item) => item.partId)),
    );
    const reasons: WorkflowBlockReason[] = [];
    if (generation !== 'ready')
      reasons.push(
        generation === 'stale'
          ? 'GENERATION_STALE'
          : generation === 'invalid'
            ? 'GENERATION_INVALID'
            : generation === 'legacy-unverified'
              ? 'GENERATION_UNVERIFIED'
              : 'GENERATION_REQUIRED',
      );
    if (!project.generatedParts.every((part) => placed.has(part.id)))
      reasons.push('PARTS_UNPLACED');
    if (validateSheetLayouts(project).some((issue) => issue.severity === 'error'))
      reasons.push('LAYOUT_INVALID');
    return reasons.length
      ? { allowed: false, reasons, suggestedStep: 'inspect' }
      : { allowed: true, reasons: [] };
  }
  return { allowed: false, reasons: [] };
}

const canonicalWorkflowSteps: readonly WorkflowStep[] = [
  'start',
  'mode',
  'import',
  'configure',
  'inspect',
  'arrange',
  'export',
];

export function visibleWorkflowSteps(
  project: ProjectData,
  experienceMode: ExperienceMode,
  generationStatus: string,
): WorkflowStep[] {
  const blockingError =
    generationStatus === 'error' ||
    (project.generationIssues ?? []).some((issue) => issue.severity === 'error');
  return [
    'start',
    'mode',
    ...(project.fabricationMode === 'panel-construction' ? [] : (['import'] as const)),
    'configure',
    ...(experienceMode === 'advanced' || blockingError ? (['inspect'] as const) : []),
    ...(experienceMode === 'advanced' ? (['arrange'] as const) : []),
    'export',
  ];
}

export function workflowStepIndex(step: WorkflowStep, steps = canonicalWorkflowSteps): number {
  return steps.indexOf(step);
}

export function stepsBefore(step: WorkflowStep, steps = canonicalWorkflowSteps): WorkflowStep[] {
  return steps.slice(0, workflowStepIndex(step, steps));
}

export function completedStepsBefore(
  completed: readonly WorkflowStep[],
  step: WorkflowStep,
  steps = canonicalWorkflowSteps,
): WorkflowStep[] {
  const limit = workflowStepIndex(step, steps);
  return completed.filter((candidate) => workflowStepIndex(candidate, steps) < limit);
}

export function inferredWorkflowProgress(
  project: ProjectData,
  experienceMode: ExperienceMode = 'standard',
): {
  activeStep: WorkflowStep;
  completedSteps: WorkflowStep[];
} {
  const steps = visibleWorkflowSteps(project, experienceMode, 'idle');
  const completed: WorkflowStep[] = ['start', 'mode'];
  const modelReady =
    project.fabricationMode === 'panel-construction' ||
    project.fabricationMode === 'fold-template' ||
    (project.model.source.kind === 'imported' &&
      Boolean(project.model.mesh && project.model.bounds));
  if (!modelReady)
    return {
      activeStep: project.fabricationMode === 'panel-construction' ? 'configure' : 'import',
      completedSteps: completed,
    };
  if (steps.includes('import')) completed.push('import');
  if (project.generatedParts.length === 0) {
    return { activeStep: 'configure', completedSteps: completed };
  }
  completed.push('configure');
  if (experienceMode === 'standard') {
    if (steps.includes('inspect')) return { activeStep: 'inspect', completedSteps: completed };
    return { activeStep: 'export', completedSteps: completed };
  }
  completed.push('inspect');
  const placedIds = new Set(
    project.sheetLayouts.flatMap((sheet) => sheet.placements.map((placement) => placement.partId)),
  );
  const fullyPlaced = project.generatedParts.every((part) => placedIds.has(part.id));
  if (!fullyPlaced) return { activeStep: 'arrange', completedSteps: completed };
  completed.push('arrange');
  return { activeStep: 'export', completedSteps: completed };
}
