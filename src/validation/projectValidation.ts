import type { ProjectData } from '../domain/project';
import type { ValidationIssue } from '../domain/validation';
import { createMeshValidationIssues } from '../geometry/mesh/createMeshValidationIssues';
import { validateSheetLayouts } from '../geometry/layout/validateSheetLayouts';
import { prepareFabricationOutput } from '../geometry/output/prepareFabricationOutput';

export function foundationValidationIssues(): ValidationIssue[] {
  return [
    {
      id: 'stacked-slicing-ready',
      severity: 'info',
      code: 'STACKED_SLICING_READY',
      message: 'Choose an axis and spacing, then generate stacked slices.',
      affectedEntityIds: [],
      suggestedAction: 'Generate the example cube or import an STL model.',
    },
  ];
}

export function validationIssuesForProject(project: ProjectData): ValidationIssue[] {
  const { model } = project;
  if (model.healthReport && model.importSettings) {
    return [
      ...createMeshValidationIssues(model.healthReport, model.importSettings, model.id),
      ...(project.generationIssues ?? []),
      ...validateSheetLayouts(project),
      ...prepareFabricationOutput(project).issues,
    ];
  }
  return [
    ...(project.generatedParts.length === 0 ? foundationValidationIssues() : []),
    ...(project.generationIssues ?? []),
    ...validateSheetLayouts(project),
    ...prepareFabricationOutput(project).issues,
  ];
}
