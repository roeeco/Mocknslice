import type { ProjectData } from '../domain/project';
import type { WorkflowStep } from './types';

export const workflowSteps: readonly WorkflowStep[] = [
  'start',
  'mode',
  'import',
  'configure',
  'inspect',
  'arrange',
  'export',
];

export function workflowStepIndex(step: WorkflowStep): number {
  return workflowSteps.indexOf(step);
}

export function stepsBefore(step: WorkflowStep): WorkflowStep[] {
  return workflowSteps.slice(0, workflowStepIndex(step));
}

export function completedStepsBefore(
  completed: readonly WorkflowStep[],
  step: WorkflowStep,
): WorkflowStep[] {
  const limit = workflowStepIndex(step);
  return completed.filter((candidate) => workflowStepIndex(candidate) < limit);
}

export function inferredWorkflowProgress(project: ProjectData): {
  activeStep: WorkflowStep;
  completedSteps: WorkflowStep[];
} {
  const completed: WorkflowStep[] = ['start', 'mode'];
  const modelReady =
    project.fabricationMode === 'panel-construction' ||
    (project.fabricationMode === 'fold-template' &&
      project.modeParameters.workflowSourceMode === 'template') ||
    (project.model.source.kind === 'imported' &&
      Boolean(project.model.mesh && project.model.bounds));
  if (!modelReady) return { activeStep: 'import', completedSteps: completed };
  completed.push('import');
  if (project.generatedParts.length === 0) {
    return { activeStep: 'configure', completedSteps: completed };
  }
  completed.push('configure');
  completed.push('inspect');
  const placedIds = new Set(
    project.sheetLayouts.flatMap((sheet) => sheet.placements.map((placement) => placement.partId)),
  );
  const fullyPlaced = project.generatedParts.every((part) => placedIds.has(part.id));
  if (!fullyPlaced) return { activeStep: 'arrange', completedSteps: completed };
  completed.push('arrange');
  return { activeStep: 'export', completedSteps: completed };
}
